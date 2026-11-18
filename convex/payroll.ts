import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { cleanText, currentUser, fail, logActivity, requireUser, requireWholeNumber } from "./lib/access";
import { addDays, isValidDate } from "./lib/dates";
import { formatPeso } from "./lib/money";
import { computePay, rateOn, weekDates, weekStartOf } from "./lib/payroll";

// The first rate applies to every day before any later change.
const FIRST_RATE_FROM = "2000-01-01";

function requireWeekStart(weekStart: string) {
  if (!isValidDate(weekStart) || weekStartOf(weekStart) !== weekStart) {
    fail("That is not the start of a pay week.", "Hindi iyan ang simula ng linggo ng sahod.");
  }
}

function requireDate(date: string) {
  if (!isValidDate(date)) fail("Choose a date.", "Pumili ng petsa.");
}

async function getEmployee(ctx: QueryCtx, employeeId: Id<"employees">) {
  const employee = await ctx.db.get("employees", employeeId);
  if (!employee) fail("Worker not found.", "Hindi makita ang tao.");
  return employee;
}

async function ratesOf(ctx: QueryCtx, employeeId: Id<"employees">) {
  return await ctx.db
    .query("employeeRates")
    .withIndex("by_employee_from", (q) => q.eq("employeeId", employeeId))
    .collect();
}

async function payslipFor(ctx: QueryCtx, employeeId: Id<"employees">, weekStart: string) {
  return await ctx.db
    .query("payslips")
    .withIndex("by_employee_week", (q) => q.eq("employeeId", employeeId).eq("weekStart", weekStart))
    .unique();
}

// The latest week paid before this one; its utang carries over.
async function previousPayslip(ctx: QueryCtx, employeeId: Id<"employees">, weekStart: string) {
  return await ctx.db
    .query("payslips")
    .withIndex("by_employee_week", (q) => q.eq("employeeId", employeeId).lt("weekStart", weekStart))
    .order("desc")
    .first();
}

async function latestPayslip(ctx: QueryCtx, employeeId: Id<"employees">) {
  return await ctx.db
    .query("payslips")
    .withIndex("by_employee_week", (q) => q.eq("employeeId", employeeId))
    .order("desc")
    .first();
}

// Days, advances and rates can't change once the week is paid.
async function requireOpenWeek(ctx: QueryCtx, employee: Doc<"employees">, date: string) {
  const weekStart = weekStartOf(date);
  if (await payslipFor(ctx, employee._id, weekStart)) {
    fail(
      `${employee.name}'s pay for this week is already done. Undo it first to make changes.`,
      `Tapos na ang sahod ni ${employee.name} sa linggong ito. I-undo muna para mabago.`,
    );
  }
}

async function weekRecords(ctx: QueryCtx, employeeId: Id<"employees">, weekStart: string) {
  const end = addDays(weekStart, 6);
  const attendance = await ctx.db
    .query("attendance")
    .withIndex("by_employee_date", (q) => q.eq("employeeId", employeeId).gte("date", weekStart).lte("date", end))
    .collect();
  const advances = await ctx.db
    .query("cashAdvances")
    .withIndex("by_employee_date", (q) => q.eq("employeeId", employeeId).gte("date", weekStart).lte("date", end))
    .collect();
  return { attendance, advances };
}

async function computeWeek(ctx: QueryCtx, employeeId: Id<"employees">, weekStart: string) {
  const { attendance, advances } = await weekRecords(ctx, employeeId, weekStart);
  const previous = await previousPayslip(ctx, employeeId, weekStart);
  const pay = computePay({
    attendance,
    rates: await ratesOf(ctx, employeeId),
    advances: advances.reduce((sum, a) => sum + a.amount, 0),
    previousDebt: previous?.carryOver ?? 0,
  });
  return { attendance, advances, previous, pay };
}

// A week before this one with days or advances that was never paid, if any.
// Weeks are paid in order so the utang carried over stays right.
async function earliestUnpaidWeek(ctx: QueryCtx, employeeId: Id<"employees">, weekStart: string) {
  const previous = await previousPayslip(ctx, employeeId, weekStart);
  const afterPaid = previous ? addDays(previous.weekStart, 6) : "";
  const day = await ctx.db
    .query("attendance")
    .withIndex("by_employee_date", (q) => q.eq("employeeId", employeeId).gt("date", afterPaid).lt("date", weekStart))
    .first();
  const advance = await ctx.db
    .query("cashAdvances")
    .withIndex("by_employee_date", (q) => q.eq("employeeId", employeeId).gt("date", afterPaid).lt("date", weekStart))
    .first();
  const dates = [day?.date, advance?.date].filter((d): d is string => d !== undefined).sort();
  return dates.length ? weekStartOf(dates[0]) : null;
}

// Everything on the Sahod tab for one week.
export const week = query({
  args: { weekStart: v.string() },
  handler: async (ctx, { weekStart }) => {
    if (!(await currentUser(ctx))) return null;
    requireWeekStart(weekStart);
    const dates = weekDates(weekStart);
    const employees = (await ctx.db.query("employees").collect()).sort((a, b) => a.name.localeCompare(b.name));
    const rows = [];
    for (const employee of employees) {
      const { attendance, advances, pay } = await computeWeek(ctx, employee._id, weekStart);
      const payslip = await payslipFor(ctx, employee._id, weekStart);
      // Archived workers only show on weeks they have something in.
      if (!employee.active && !payslip && attendance.length === 0 && advances.length === 0) continue;
      const rates = (await ratesOf(ctx, employee._id)).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
      rows.push({
        employee,
        rates: rates.map((r) => ({ _id: r._id, dailyRate: r.dailyRate, effectiveFrom: r.effectiveFrom === FIRST_RATE_FROM ? null : r.effectiveFrom })),
        rateByDate: Object.fromEntries(dates.map((date) => [date, rateOn(rates, date)])),
        days: Object.fromEntries(attendance.map((a) => [a.date, a.days])),
        advances: advances.sort((a, b) => a.date.localeCompare(b.date) || a._creationTime - b._creationTime),
        // A paid week shows what was saved; an open one, the live numbers.
        pay: payslip
          ? { ...payslip, net: payslip.gross - payslip.advances - payslip.previousDebt }
          : pay,
        payslipId: payslip?._id ?? null,
        // Only the latest paid week can be undone, so the utang chain stays right.
        canUndo: payslip ? (await latestPayslip(ctx, employee._id))?._id === payslip._id : false,
        earlierUnpaidWeek: payslip ? null : await earliestUnpaidWeek(ctx, employee._id, weekStart),
      });
    }
    return { weekStart, dates, rows };
  },
});

export const archived = query({
  args: {},
  handler: async (ctx) => {
    if (!(await currentUser(ctx))) return null;
    return (await ctx.db.query("employees").collect())
      .filter((e) => !e.active)
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const addEmployee = mutation({
  args: { name: v.string(), dailyRate: v.number() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const name = cleanText(args.name);
    if (!name) fail("Enter the worker's name.", "Ilagay ang pangalan ng tao.");
    requireWholeNumber(args.dailyRate, ["Daily rate", "sahod kada araw"], { min: 1 });
    const existing = (await ctx.db.query("employees").collect()).find((e) => e.name.toLowerCase() === name.toLowerCase());
    if (existing) fail(`There is already a worker named ${existing.name}.`, `Mayroon nang taong ${existing.name}.`);
    const employeeId = await ctx.db.insert("employees", { name, active: true });
    await ctx.db.insert("employeeRates", { employeeId, dailyRate: args.dailyRate, effectiveFrom: FIRST_RATE_FROM });
    await logActivity(ctx, userId, "Added worker", `${name} at ${formatPeso(args.dailyRate)} a day`);
    return employeeId;
  },
});

export const renameEmployee = mutation({
  args: { employeeId: v.id("employees"), name: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const employee = await getEmployee(ctx, args.employeeId);
    const name = cleanText(args.name);
    if (!name) fail("Enter the worker's name.", "Ilagay ang pangalan ng tao.");
    const duplicate = (await ctx.db.query("employees").collect()).find(
      (e) => e._id !== employee._id && e.name.toLowerCase() === name.toLowerCase(),
    );
    if (duplicate) fail(`There is already a worker named ${duplicate.name}.`, `Mayroon nang taong ${duplicate.name}.`);
    await ctx.db.patch("employees", employee._id, { name });
    if (name !== employee.name) await logActivity(ctx, userId, "Updated worker", `${employee.name} → ${name}`);
  },
});

export const setActive = mutation({
  args: { employeeId: v.id("employees"), active: v.boolean() },
  handler: async (ctx, { employeeId, active }) => {
    const userId = await requireUser(ctx);
    const employee = await getEmployee(ctx, employeeId);
    await ctx.db.patch("employees", employeeId, { active });
    await logActivity(ctx, userId, active ? "Restored worker" : "Archived worker", employee.name);
  },
});

// A raise (or any change) starting on a date. Earlier days keep the old rate.
export const setRate = mutation({
  args: { employeeId: v.id("employees"), dailyRate: v.number(), effectiveFrom: v.string() },
  handler: async (ctx, { employeeId, dailyRate, effectiveFrom }) => {
    const userId = await requireUser(ctx);
    const employee = await getEmployee(ctx, employeeId);
    requireWholeNumber(dailyRate, ["Daily rate", "sahod kada araw"], { min: 1 });
    requireDate(effectiveFrom);
    const latest = await latestPayslip(ctx, employeeId);
    if (latest && latest.weekStart >= weekStartOf(effectiveFrom)) {
      fail(
        `${employee.name} was already paid for the week of this date. Choose a later date.`,
        `Bayad na si ${employee.name} sa linggo ng petsang ito. Pumili ng mas huling petsa.`,
      );
    }
    const rates = await ratesOf(ctx, employeeId);
    const before = rateOn(rates, effectiveFrom);
    const sameDay = rates.find((r) => r.effectiveFrom === effectiveFrom);
    if (sameDay) await ctx.db.patch("employeeRates", sameDay._id, { dailyRate });
    else await ctx.db.insert("employeeRates", { employeeId, dailyRate, effectiveFrom });
    await logActivity(
      ctx,
      userId,
      "Changed daily rate",
      `${employee.name}: ${formatPeso(before)} → ${formatPeso(dailyRate)} from ${effectiveFrom}`,
    );
  },
});

// Removes a rate change; the days go back to the rate before it.
export const removeRate = mutation({
  args: { rateId: v.id("employeeRates") },
  handler: async (ctx, { rateId }) => {
    const userId = await requireUser(ctx);
    const rate = await ctx.db.get("employeeRates", rateId);
    if (!rate) fail("Rate not found.", "Hindi makita ang rate.");
    if (rate.effectiveFrom === FIRST_RATE_FROM) fail("The first rate can't be removed. Change it instead.", "Hindi matatanggal ang unang rate. Palitan na lang.");
    const employee = await getEmployee(ctx, rate.employeeId);
    const latest = await latestPayslip(ctx, employee._id);
    if (latest && latest.weekStart >= weekStartOf(rate.effectiveFrom)) {
      fail(
        `${employee.name} was already paid with this rate, so it can't be removed.`,
        `Nabayaran na si ${employee.name} gamit ang rate na ito kaya hindi na matatanggal.`,
      );
    }
    await ctx.db.delete("employeeRates", rateId);
    await logActivity(ctx, userId, "Changed daily rate", `${employee.name}: removed ${formatPeso(rate.dailyRate)} from ${rate.effectiveFrom}`);
  },
});

// 1 = whole day, 0.5 = half day, 0 = absent.
export const setAttendance = mutation({
  args: { employeeId: v.id("employees"), date: v.string(), days: v.number() },
  handler: async (ctx, { employeeId, date, days }) => {
    await requireUser(ctx);
    const employee = await getEmployee(ctx, employeeId);
    requireDate(date);
    if (days !== 0 && days !== 0.5 && days !== 1) fail("Mark a whole day, half day or absent.", "Buong araw, kalahating araw o absent lang.");
    await requireOpenWeek(ctx, employee, date);
    const existing = await ctx.db
      .query("attendance")
      .withIndex("by_employee_date", (q) => q.eq("employeeId", employeeId).eq("date", date))
      .unique();
    if (days === 0) {
      if (existing) await ctx.db.delete("attendance", existing._id);
    } else if (existing) {
      await ctx.db.patch("attendance", existing._id, { days });
    } else {
      await ctx.db.insert("attendance", { employeeId, date, days });
    }
  },
});

export const addAdvance = mutation({
  args: { employeeId: v.id("employees"), date: v.string(), amount: v.number(), note: v.optional(v.string()) },
  handler: async (ctx, { employeeId, date, amount, note }) => {
    const userId = await requireUser(ctx);
    const employee = await getEmployee(ctx, employeeId);
    requireDate(date);
    requireWholeNumber(amount, ["Amount", "halaga"], { min: 1 });
    await requireOpenWeek(ctx, employee, date);
    await ctx.db.insert("cashAdvances", { employeeId, date, amount, note: cleanText(note) });
    await logActivity(ctx, userId, "Cash advance", `${employee.name}: ${formatPeso(amount)} on ${date}`);
  },
});

export const removeAdvance = mutation({
  args: { advanceId: v.id("cashAdvances") },
  handler: async (ctx, { advanceId }) => {
    const userId = await requireUser(ctx);
    const advance = await ctx.db.get("cashAdvances", advanceId);
    if (!advance) fail("Cash advance not found.", "Hindi makita ang cash advance.");
    const employee = await getEmployee(ctx, advance.employeeId);
    await requireOpenWeek(ctx, employee, advance.date);
    await ctx.db.delete("cashAdvances", advanceId);
    await logActivity(ctx, userId, "Removed cash advance", `${employee.name}: ${formatPeso(advance.amount)} on ${advance.date}`);
  },
});

// Saves the week's pay. Any utang left carries to the next week.
export const payWeek = mutation({
  args: { employeeId: v.id("employees"), weekStart: v.string() },
  handler: async (ctx, { employeeId, weekStart }) => {
    const userId = await requireUser(ctx);
    requireWeekStart(weekStart);
    const employee = await getEmployee(ctx, employeeId);
    await requireOpenWeek(ctx, employee, weekStart);
    const latest = await latestPayslip(ctx, employeeId);
    if (latest && latest.weekStart > weekStart) {
      fail(
        `${employee.name} was already paid for a later week. Undo that week first.`,
        `Bayad na si ${employee.name} sa mas bagong linggo. I-undo muna iyon.`,
      );
    }
    const unpaid = await earliestUnpaidWeek(ctx, employeeId, weekStart);
    if (unpaid) {
      fail(
        `${employee.name} has an earlier week not yet paid (week of ${unpaid}). Pay that week first.`,
        `May naunang linggo pa si ${employee.name} na hindi pa bayad (linggo ng ${unpaid}). Iyon muna ang bayaran.`,
      );
    }
    const { pay } = await computeWeek(ctx, employeeId, weekStart);
    if (pay.days === 0 && pay.advances === 0 && pay.previousDebt === 0) {
      fail(`${employee.name} has no days or cash advances this week.`, `Walang araw o cash advance si ${employee.name} sa linggong ito.`);
    }
    await ctx.db.insert("payslips", {
      employeeId,
      weekStart,
      days: pay.days,
      gross: pay.gross,
      advances: pay.advances,
      previousDebt: pay.previousDebt,
      paidOut: pay.paidOut,
      carryOver: pay.carryOver,
    });
    await logActivity(
      ctx,
      userId,
      "Paid wages",
      `${employee.name}, week of ${weekStart}: ${formatPeso(pay.paidOut)}${pay.carryOver ? `, utang ${formatPeso(pay.carryOver)}` : ""}`,
    );
  },
});

export const undoPay = mutation({
  args: { payslipId: v.id("payslips") },
  handler: async (ctx, { payslipId }) => {
    const userId = await requireUser(ctx);
    const payslip = await ctx.db.get("payslips", payslipId);
    if (!payslip) fail("Pay not found.", "Hindi makita ang sahod.");
    const employee = await getEmployee(ctx, payslip.employeeId);
    if ((await latestPayslip(ctx, employee._id))?._id !== payslipId) {
      fail("Undo the later weeks first.", "I-undo muna ang mga mas bagong linggo.");
    }
    await ctx.db.delete("payslips", payslipId);
    await logActivity(ctx, userId, "Undid wages", `${employee.name}, week of ${payslip.weekStart}`);
  },
});
