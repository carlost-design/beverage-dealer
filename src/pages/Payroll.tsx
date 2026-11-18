import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, ChevronLeft, ChevronRight, Coins, Pencil, Plus, Trash2, UserPlus, Wallet, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { weekStartOf } from "../../convex/lib/payroll";
import { Alert, Avatar, Button, Card, Chip, EmptyState, Field, Input, Modal, PageHeader, PageLoading, PesoInput, Select, StatCard } from "../components/ui";
import { useErrorMessage, useFmt, useT } from "../i18n";
import { cx, parsePeso } from "../lib/format";
import { addDays, useToday } from "../lib/useToday";

type Week = NonNullable<ReturnType<typeof useWeek>>;
type Row = Week["rows"][number];

function useWeek(weekStart: string) {
  return useQuery(api.payroll.week, { weekStart });
}

// The Sahod tab: one card per worker for the week, Monday to Sunday.
export default function Payroll() {
  const t = useT();
  const fmt = useFmt();
  const today = useToday();
  const thisWeek = weekStartOf(today);
  const [weekStart, setWeekStart] = useState(thisWeek);
  const data = useWeek(weekStart);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<Id<"employees"> | null>(null);

  if (!data) return <PageLoading />;
  const active = data.rows.filter((row) => row.employee.active);
  const archived = data.rows.filter((row) => !row.employee.active);
  const editing = data.rows.find((row) => row.employee._id === editingId);
  const sum = (pick: (row: Row) => number) => data.rows.reduce((total, row) => total + pick(row), 0);

  return (
    <>
      <PageHeader
        title={t.payroll.title}
        description={t.payroll.hint}
        actions={
          <Button size="lg" onClick={() => setAdding(true)}>
            <UserPlus className="size-6" /> {t.payroll.addWorker}
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Button variant="secondary" aria-label={t.payroll.previousWeek} onClick={() => setWeekStart(addDays(weekStart, -7))} className="w-12 px-0">
          <ChevronLeft className="size-6" />
        </Button>
        <span className="inline-flex h-12 items-center rounded-full border border-line-strong bg-white px-5 text-base font-semibold text-ink shadow-xs">
          {t.payroll.week(fmt.shortDate(weekStart), fmt.date(addDays(weekStart, 6)))}
        </span>
        <Button
          variant="secondary"
          aria-label={t.payroll.nextWeek}
          disabled={weekStart >= thisWeek}
          onClick={() => setWeekStart(addDays(weekStart, 7))}
          className="w-12 px-0"
        >
          <ChevronRight className="size-6" />
        </Button>
        {weekStart !== thisWeek && (
          <Button variant="soft" onClick={() => setWeekStart(thisWeek)}>
            {t.payroll.thisWeek}
          </Button>
        )}
      </div>

      {data.rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Wallet}
            title={t.payroll.emptyTitle}
            action={
              <Button onClick={() => setAdding(true)}>
                <UserPlus className="size-5" /> {t.payroll.addWorker}
              </Button>
            }
          >
            {t.payroll.emptyHint}
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard title={t.payroll.totals.pay} icon={Wallet} tone="green" value={fmt.money(sum((row) => row.pay.paidOut))} />
            <StatCard title={t.payroll.totals.advances} icon={Coins} tone="amber" value={fmt.money(sum((row) => row.pay.advances))} />
            <StatCard
              title={t.payroll.totals.debt}
              icon={AlertTriangle}
              tone="red"
              value={fmt.money(sum((row) => row.pay.carryOver))}
              valueTone={sum((row) => row.pay.carryOver) > 0 ? "red" : "default"}
            />
          </div>
          <p className="text-base text-ink-3">{t.payroll.tapHint}</p>
          {[...active, ...archived].map((row) => (
            <WorkerCard
              key={row.employee._id}
              row={row}
              dates={data.dates}
              weekStart={weekStart}
              today={today}
              onEdit={() => setEditingId(row.employee._id)}
              onGoToWeek={setWeekStart}
            />
          ))}
        </div>
      )}

      <ArchivedWorkers />

      {adding && <AddWorkerModal onClose={() => setAdding(false)} />}
      {editing && <EditWorkerModal key={editing.employee._id} row={editing} today={today} onClose={() => setEditingId(null)} />}
    </>
  );
}

function WorkerCard({
  row,
  dates,
  weekStart,
  today,
  onEdit,
  onGoToWeek,
}: {
  row: Row;
  dates: string[];
  weekStart: string;
  today: string;
  onEdit: () => void;
  onGoToWeek: (weekStart: string) => void;
}) {
  const t = useT();
  const fmt = useFmt();
  const errorMessage = useErrorMessage();
  const setAttendance = useMutation(api.payroll.setAttendance);
  const removeAdvance = useMutation(api.payroll.removeAdvance);
  const undoPay = useMutation(api.payroll.undoPay);
  const [addingAdvance, setAddingAdvance] = useState(false);
  const [paying, setPaying] = useState(false);
  const { employee, pay } = row;
  const paid = row.payslipId !== null;
  const lastRate = row.rateByDate[dates[6]];
  const firstRate = row.rateByDate[dates[0]];
  const changeDate = dates.find((date) => row.rateByDate[date] !== firstRate);

  async function run(action: () => Promise<unknown>, success?: string) {
    try {
      await action();
      if (success) toast.success(success);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  // Absent → whole day → half day → absent.
  function nextDays(days: number) {
    return days === 0 ? 1 : days === 1 ? 0.5 : 0;
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={employee.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-bold text-ink">
            {employee.name} {!employee.active && <Chip tone="gray">{t.payroll.archivedChip}</Chip>}
          </p>
          <p className="text-base text-ink-3 tabular">
            {changeDate
              ? `${t.payroll.perDay(fmt.money(firstRate))} · ${t.payroll.rateChangesThisWeek(fmt.money(lastRate), fmt.shortDate(changeDate))}`
              : t.payroll.perDay(fmt.money(lastRate))}
          </p>
        </div>
        {paid && <Chip tone="green">{t.payroll.paid}</Chip>}
        <Button variant="secondary" size="sm" onClick={onEdit}>
          <Pencil className="size-4" /> {t.common.edit}
        </Button>
      </div>

      {row.earlierUnpaidWeek && (
        <div className="mt-4">
          <Alert
            icon={AlertTriangle}
            title={t.payroll.earlierUnpaid(fmt.shortDate(row.earlierUnpaidWeek))}
            action={
              <Button variant="secondary" size="sm" onClick={() => onGoToWeek(row.earlierUnpaidWeek!)}>
                {t.payroll.goToWeek}
              </Button>
            }
          />
        </div>
      )}

      <div className="mt-4 grid grid-cols-7 gap-1.5 sm:gap-2">
        {dates.map((date) => {
          const days = row.days[date] ?? 0;
          const state = days === 1 ? "whole" : days === 0.5 ? "half" : "absent";
          return (
            <button
              key={date}
              type="button"
              disabled={paid || date > today}
              onClick={() => run(() => setAttendance({ employeeId: employee._id, date, days: nextDays(days) }))}
              aria-label={t.payroll.dayLabel(fmt.day(date), t.payroll.dayStates[state])}
              className={cx(
                "flex flex-col items-center rounded-xl border-2 py-2 transition-colors disabled:cursor-not-allowed",
                state === "whole" && "border-[#16A34A] bg-[#E8F7EE] text-[#146C43]",
                state === "half" && "border-[#F59E0B] bg-[#FEF3E2] text-[#93370D]",
                state === "absent" && "border-line bg-white text-ink-3 hover:border-line-strong",
                date > today && "opacity-40",
                date === today && state === "absent" && "border-brand",
              )}
            >
              <span className="text-sm font-semibold">{fmt.weekday(date)}</span>
              <span className="text-xs tabular">{date.slice(8)}</span>
              <span className="mt-0.5 h-7 text-xl leading-7 font-bold">{state === "whole" ? "✓" : state === "half" ? "½" : ""}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-2xl bg-gray-50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-base font-semibold text-ink-2">{t.payroll.advances}</p>
          {!paid && (
            <Button variant="secondary" size="sm" onClick={() => setAddingAdvance(true)}>
              <Plus className="size-4" /> {t.payroll.addAdvance}
            </Button>
          )}
        </div>
        {row.advances.length > 0 && (
          <ul className="mt-2 divide-y divide-line">
            {row.advances.map((advance) => (
              <li key={advance._id} className="flex items-center gap-3 py-2">
                <span className="text-base text-ink-3 tabular">{fmt.shortDate(advance.date)}</span>
                <span className="min-w-0 flex-1 truncate text-base text-ink-2">{advance.note}</span>
                <span className="text-base font-semibold tabular">{fmt.money(advance.amount)}</span>
                {!paid && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-10 px-0 text-[#B42318]"
                    aria-label={t.payroll.removeAdvance(fmt.money(advance.amount))}
                    onClick={() => run(() => removeAdvance({ advanceId: advance._id }), t.payroll.advanceRemoved)}
                  >
                    <X className="size-5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <dl className="mt-4 space-y-1.5 text-lg">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-3">
            {t.payroll.gross} <span className="text-base">· {t.payroll.grossDetail(t.payroll.days(pay.days))}</span>
          </dt>
          <dd className="font-semibold tabular">{fmt.money(pay.gross)}</dd>
        </div>
        {pay.advances > 0 && (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-3">{t.payroll.lessAdvances}</dt>
            <dd className="font-semibold text-[#B42318] tabular">−{fmt.money(pay.advances)}</dd>
          </div>
        )}
        {pay.previousDebt > 0 && (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-3">{t.payroll.lessDebt}</dt>
            <dd className="font-semibold text-[#B42318] tabular">−{fmt.money(pay.previousDebt)}</dd>
          </div>
        )}
      </dl>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-soft px-4 py-3">
        <div>
          <p className="text-lg font-bold text-ink">{t.payroll.toReceive}</p>
          {pay.carryOver > 0 && (
            <p className="text-base font-semibold text-[#B42318] tabular">
              {t.payroll.carryOver}: {fmt.money(pay.carryOver)}
            </p>
          )}
        </div>
        <span className="text-3xl font-bold tracking-tight text-ink tabular">{fmt.money(pay.paidOut)}</span>
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-3">
        {paid ? (
          row.canUndo && (
            <Button variant="ghost" onClick={() => run(() => undoPay({ payslipId: row.payslipId! }), t.payroll.undone)}>
              {t.payroll.undo}
            </Button>
          )
        ) : (
          <Button variant="success" size="lg" onClick={() => setPaying(true)} disabled={row.earlierUnpaidWeek !== null}>
            <Wallet className="size-6" /> {t.payroll.markPaid}
          </Button>
        )}
      </div>

      {addingAdvance && (
        <AdvanceModal row={row} dates={dates} weekStart={weekStart} today={today} onClose={() => setAddingAdvance(false)} />
      )}
      {paying && <PayModal row={row} weekStart={weekStart} onClose={() => setPaying(false)} />}
    </Card>
  );
}

function PayModal({ row, weekStart, onClose }: { row: Row; weekStart: string; onClose: () => void }) {
  const t = useT();
  const fmt = useFmt();
  const errorMessage = useErrorMessage();
  const payWeek = useMutation(api.payroll.payWeek);
  const [saving, setSaving] = useState(false);
  const { employee, pay } = row;

  async function confirm() {
    setSaving(true);
    try {
      await payWeek({ employeeId: employee._id, weekStart });
      toast.success(t.payroll.paidToast(employee.name));
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t.payroll.payTitle(employee.name)}
      description={t.payroll.payBody}
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button variant="success" size="lg" onClick={confirm} loading={saving}>
            {t.payroll.payConfirm}
          </Button>
        </>
      }
    >
      <dl className="space-y-2 text-lg">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-3">{t.payroll.toReceive}</dt>
          <dd className="text-2xl font-bold tabular">{fmt.money(pay.paidOut)}</dd>
        </div>
        {pay.carryOver > 0 && (
          <div className="flex justify-between gap-3 text-[#B42318]">
            <dt>{t.payroll.carryOver}</dt>
            <dd className="font-bold tabular">{fmt.money(pay.carryOver)}</dd>
          </div>
        )}
      </dl>
    </Modal>
  );
}

function AdvanceModal({
  row,
  dates,
  weekStart,
  today,
  onClose,
}: {
  row: Row;
  dates: string[];
  weekStart: string;
  today: string;
  onClose: () => void;
}) {
  const t = useT();
  const fmt = useFmt();
  const errorMessage = useErrorMessage();
  const addAdvance = useMutation(api.payroll.addAdvance);
  const choices = dates.filter((date) => date <= today);
  const [date, setDate] = useState(choices.includes(today) ? today : (choices[choices.length - 1] ?? weekStart));
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const value = parsePeso(amount);
    if (!value) return toast.error(t.payroll.needAmount);
    setSaving(true);
    try {
      await addAdvance({ employeeId: row.employee._id, date, amount: value, note: note.trim() || undefined });
      toast.success(t.payroll.advanceSaved);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t.payroll.advanceTitle(row.employee.name)} description={t.payroll.advanceHint}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label={t.payroll.amount}>
          <PesoInput value={amount} onChange={setAmount} required autoFocus />
        </Field>
        <Field label={t.payroll.date} hint={t.payroll.dateInWeek}>
          <Select value={date} onChange={(e) => setDate(e.target.value)}>
            {(choices.length ? choices : [weekStart]).map((d) => (
              <option key={d} value={d}>
                {fmt.day(d)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t.payroll.note} hint={t.common.optional}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" size="lg" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit" size="lg" loading={saving}>
            {t.common.save}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function AddWorkerModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const errorMessage = useErrorMessage();
  const addEmployee = useMutation(api.payroll.addEmployee);
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return toast.error(t.payroll.needName);
    const dailyRate = parsePeso(rate);
    if (!dailyRate) return toast.error(t.payroll.needRate);
    setSaving(true);
    try {
      await addEmployee({ name, dailyRate });
      toast.success(t.payroll.workerAdded(name.trim()));
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t.payroll.workerAdd}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label={t.payroll.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </Field>
        <Field label={t.payroll.dailyRate}>
          <PesoInput value={rate} onChange={setRate} required />
        </Field>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" size="lg" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit" size="lg" loading={saving}>
            {t.payroll.workerAdd}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// Change the name, give a raise from a date, or archive.
function EditWorkerModal({ row, today, onClose }: { row: Row; today: string; onClose: () => void }) {
  const t = useT();
  const fmt = useFmt();
  const errorMessage = useErrorMessage();
  const renameEmployee = useMutation(api.payroll.renameEmployee);
  const setRate = useMutation(api.payroll.setRate);
  const removeRate = useMutation(api.payroll.removeRate);
  const setActive = useMutation(api.payroll.setActive);
  const { employee } = row;
  const [name, setName] = useState(employee.name);
  const [rate, setRateText] = useState("");
  const [from, setFrom] = useState(today);
  const [saving, setSaving] = useState<"name" | "rate" | null>(null);

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      toast.success(success);
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    }
  }

  async function saveName(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return toast.error(t.payroll.needName);
    setSaving("name");
    await run(() => renameEmployee({ employeeId: employee._id, name }), t.payroll.workerSaved(name.trim()));
    setSaving(null);
  }

  async function saveRate(event: FormEvent) {
    event.preventDefault();
    const dailyRate = parsePeso(rate);
    if (!dailyRate) return toast.error(t.payroll.needRate);
    setSaving("rate");
    if (await run(() => setRate({ employeeId: employee._id, dailyRate, effectiveFrom: from }), t.payroll.rateSaved)) setRateText("");
    setSaving(null);
  }

  async function toggleActive() {
    const ok = await run(
      () => setActive({ employeeId: employee._id, active: !employee.active }),
      employee.active ? t.payroll.archivedToast(employee.name) : t.payroll.restoredToast(employee.name),
    );
    if (ok) onClose();
  }

  return (
    <Modal open onClose={onClose} title={t.payroll.workerEdit(employee.name)}>
      <div className="space-y-6">
        <form onSubmit={saveName} className="flex flex-wrap items-end gap-3">
          <Field label={t.payroll.name} className="min-w-48 flex-1">
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Button type="submit" size="lg" variant="secondary" loading={saving === "name"} disabled={name.trim() === employee.name}>
            {t.common.save}
          </Button>
        </form>

        <div>
          <p className="mb-2 text-base font-semibold text-ink-2">{t.payroll.rateHistory}</p>
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {row.rates.map((r) => (
              <li key={r._id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex-1 text-base text-ink-3">{r.effectiveFrom ? t.payroll.since(fmt.date(r.effectiveFrom)) : t.payroll.fromStart}</span>
                <span className="text-lg font-semibold tabular">{fmt.money(r.dailyRate)}</span>
                {r.effectiveFrom && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-10 px-0 text-[#B42318]"
                    aria-label={t.payroll.removeRate(fmt.money(r.dailyRate))}
                    onClick={() => run(() => removeRate({ rateId: r._id }), t.payroll.rateRemoved)}
                  >
                    <Trash2 className="size-5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>

        <form onSubmit={saveRate} className="space-y-4 rounded-2xl border border-line p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.payroll.newRate}>
              <PesoInput value={rate} onChange={setRateText} />
            </Field>
            <Field label={t.payroll.rateFrom} hint={t.payroll.rateFromHint}>
              <Input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="lg" loading={saving === "rate"}>
              {t.payroll.changeRate}
            </Button>
          </div>
        </form>

        <div className="flex justify-between gap-3 border-t border-line pt-4">
          <Button variant="ghost" onClick={toggleActive}>
            {employee.active ? t.payroll.archive : t.payroll.restore}
          </Button>
          <Button variant="secondary" size="lg" onClick={onClose}>
            {t.common.done}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// Archived workers with nothing this week, so they can be brought back.
function ArchivedWorkers() {
  const t = useT();
  const errorMessage = useErrorMessage();
  const archived = useQuery(api.payroll.archived);
  const setActive = useMutation(api.payroll.setActive);
  if (!archived || archived.length === 0) return null;
  return (
    <div className="mt-8">
      <p className="mb-2 text-base font-semibold text-ink-3">{t.payroll.archivedTitle}</p>
      <ul className="flex flex-wrap gap-2">
        {archived.map((employee) => (
          <li key={employee._id} className="flex items-center gap-2 rounded-full border border-line bg-white py-1 pr-1 pl-4">
            <span className="text-base text-ink-2">{employee.name}</span>
            <Button
              variant="soft"
              size="sm"
              onClick={async () => {
                try {
                  await setActive({ employeeId: employee._id, active: true });
                  toast.success(t.payroll.restoredToast(employee.name));
                } catch (err) {
                  toast.error(errorMessage(err));
                }
              }}
            >
              {t.payroll.restore}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
