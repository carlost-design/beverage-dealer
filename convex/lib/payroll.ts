import { addDays } from "./dates";

// Shared by the server and the Sahod screen. Money is in centavos.
// A pay week runs Monday to Sunday and is named by its Monday.

export function weekStartOf(date: string): string {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, -((weekday + 6) % 7));
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

type Rate = { dailyRate: number; effectiveFrom: string };

// The rate on a date: the latest one that started on or before it.
export function rateOn(rates: Rate[], date: string): number {
  let found: Rate | undefined;
  for (const rate of rates) {
    if (rate.effectiveFrom <= date && (!found || rate.effectiveFrom > found.effectiveFrom)) found = rate;
  }
  return found?.dailyRate ?? 0;
}

// Pay − cash advances − last week's utang. What is left after that is paid
// out; if it goes below zero, the rest is utang carried to next week.
export function computePay(input: {
  attendance: { date: string; days: number }[];
  rates: Rate[];
  advances: number;
  previousDebt: number;
}) {
  const days = input.attendance.reduce((sum, a) => sum + a.days, 0);
  const gross = Math.round(input.attendance.reduce((sum, a) => sum + a.days * rateOn(input.rates, a.date), 0));
  const net = gross - input.advances - input.previousDebt;
  return {
    days,
    gross,
    advances: input.advances,
    previousDebt: input.previousDebt,
    net,
    paidOut: Math.max(net, 0),
    carryOver: Math.max(-net, 0),
  };
}
