import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, CheckCircle2, Home as HomeIcon, Pencil, Printer, Wallet } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { PrintPreview } from "../components/print";
import { StatementSlip } from "../components/receipts";
import { ClientName } from "../components/status";
import {
  Alert,
  Avatar,
  Button,
  Card,
  ChoiceCards,
  Chip,
  EmptyState,
  Field,
  Input,
  LinkButton,
  PageLoading,
  PesoInput,
  SearchField,
  StepHeader,
} from "../components/ui";
import { useErrorMessage, useFmt, useT } from "../i18n";
import { cx, parsePeso, pesoInput } from "../lib/format";
import { useToday } from "../lib/useToday";
import { useTourPage } from "../tour/TourProvider";

type Method = "cash" | "gcash" | "maya" | "bank" | "check";

export default function ReceivePayment() {
  const t = useT();
  const fmt = useFmt();
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const clients = useQuery(api.clients.list, { today });
  const [search, setSearch] = useState("");
  const [done, setDone] = useState<{ amount: number; clientId: Id<"clients"> } | null>(null);
  const clientId = params.get("client");
  useTourPage(done ? null : clientId ? "pay-amount" : "pay-client");

  if (!clients) return <PageLoading />;
  if (done) return <Done amount={done.amount} clientId={done.clientId} today={today} onAnother={() => { setDone(null); setParams({}); }} />;

  const chosen = clientId ? clients.find((c) => c._id === clientId) : undefined;
  if (chosen) {
    return (
      <PaymentForm
        clientId={chosen._id}
        today={today}
        onChangeClient={() => setParams({})}
        onDone={(amount) => setDone({ amount, clientId: chosen._id })}
      />
    );
  }

  const term = search.trim().toLowerCase();
  const owing = clients
    .filter((c) => c.active && c.balance > 0)
    .filter((c) => !term || `${c.name} ${c.storeName ?? ""}`.toLowerCase().includes(term))
    .sort((a, b) => b.daysLate - a.daysLate || b.balance - a.balance);

  return (
    <div className="mx-auto max-w-3xl pb-10">
      <p className="mb-4 text-lg font-semibold text-ink-3">{t.pay.title}</p>
      <StepHeader step={1} of={2} title={t.pay.whoIsPaying} />
      <p className="-mt-3 mb-5 text-base text-ink-3">{t.pay.onlyWithUtang}</p>
      <div className="mb-4" data-tour="pay-search">
        <SearchField value={search} onChange={setSearch} placeholder={t.flow.typeName} />
      </div>
      {owing.length === 0 ? (
        <Card>
          <EmptyState icon={CheckCircle2} title={term ? t.clients.noMatch : t.pay.noUtang} />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2" data-tour="pay-list">
          {owing.map((c) => {
            const late = c.daysLate > 0;
            return (
              <li key={c._id}>
                <button
                  type="button"
                  onClick={() => setParams({ client: c._id })}
                  className={cx(
                    "flex w-full items-center gap-3 rounded-2xl border-2 bg-white p-4 text-left shadow-card hover:border-line-strong",
                    late ? "border-red-200" : "border-transparent",
                  )}
                >
                  <Avatar name={c.name} late={late} />
                  <span className="min-w-0 flex-1">
                    <ClientName name={c.name} isLate={late} className="block truncate text-lg" />
                    <span className="block truncate text-sm text-ink-3">{c.storeName ?? fmt.terms(c.termsDays)}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <span className={cx("text-lg font-bold tabular", late && "text-[#B42318]")}>{fmt.money(c.balance)}</span>
                    {late && (
                      <Chip tone="red" solid>
                        {t.status.late(c.daysLate)}
                      </Chip>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function PaymentForm({
  clientId,
  today,
  onChangeClient,
  onDone,
}: {
  clientId: Id<"clients">;
  today: string;
  onChangeClient: () => void;
  onDone: (amount: number) => void;
}) {
  const t = useT();
  const fmt = useFmt();
  const errorMessage = useErrorMessage();
  const data = useQuery(api.clients.get, { clientId, today });
  const receive = useMutation(api.payments.receiveForClient);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("cash");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  if (!data) return <PageLoading />;
  const { client } = data;
  const total = data.balance;
  const value = parsePeso(amount) ?? 0;
  let remaining = value;
  const allocation = [];
  for (const order of data.openOrders) {
    if (remaining <= 0) break;
    const pay = Math.min(remaining, order.balance);
    allocation.push({ ...order, pay });
    remaining -= pay;
  }

  async function save() {
    if (value <= 0) return toast.error(t.pay.enterAmount);
    if (value > total) return toast.error(t.pay.tooMuch(fmt.money(total)));
    setSaving(true);
    try {
      await receive({ clientId, amount: value, method, reference });
      onDone(value);
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl pb-40 lg:pb-28">
      <p className="mb-4 text-lg font-semibold text-ink-3">{t.pay.title}</p>
      <StepHeader step={2} of={2} title={t.pay.howMuch(client.name)} />

      <Card className="mb-5 flex items-center gap-4 p-4">
        <Avatar name={client.name} late={data.daysLate > 0} />
        <div className="min-w-0 flex-1">
          <ClientName name={client.name} isLate={data.daysLate > 0} className="block truncate text-lg" />
          <p className="text-base text-ink-3">{t.pay.totalUtang(fmt.money(total))}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={onChangeClient}>
          <Pencil className="size-4" /> {t.common.change}
        </Button>
      </Card>
      {data.daysLate > 0 && (
        <div className="mb-5">
          <Alert tone="red" title={t.clients.lateTitle(data.daysLate)}>
            {t.clients.lateHint(fmt.money(data.lateBalance), fmt.money(total))}
          </Alert>
        </div>
      )}

      <Card className="space-y-5 p-5 sm:p-6" data-tour="pay-amount">
        <Field label={t.flow.amountReceived}>
          <div className="flex flex-col gap-3 sm:flex-row">
            <PesoInput value={amount} onChange={setAmount} placeholder={pesoInput(total)} className="flex-1" autoFocus />
            <Button variant="soft" onClick={() => setAmount(pesoInput(total))}>
              {t.pay.payAll}
            </Button>
          </div>
        </Field>
        <div>
          <p className="mb-2 text-base font-semibold text-ink-2">{t.flow.paidWith}</p>
          <ChoiceCards
            label={t.flow.paidWith}
            value={method}
            onChange={setMethod}
            columns={5}
            options={(["cash", "gcash", "maya", "bank", "check"] as const).map((m) => ({ value: m, label: t.methods[m] }))}
          />
        </div>
        {method !== "cash" && (
          <Field label={t.flow.reference} hint={t.flow.referenceHint}>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
        )}
        {allocation.length > 0 && value <= total && (
          <div className="rounded-2xl bg-canvas p-4">
            <p className="mb-2 text-base font-semibold text-ink-2">{t.pay.thisPays}</p>
            <ul className="space-y-2">
              {allocation.map((row) => (
                <li key={row._id} className="flex justify-between gap-3 text-base">
                  <span className={cx(row.isLate && "font-semibold text-[#B42318]")}>
                    {row.pay === row.balance ? t.pay.inFull(row.orderNo) : t.pay.partOf(row.orderNo, fmt.money(row.balance))}
                  </span>
                  <span className="font-bold tabular">{fmt.money(row.pay)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {value > total && <Alert tone="red" title={t.pay.tooMuch(fmt.money(total))} />}
      </Card>

      <div data-tour="flow-bar" className="fixed inset-x-0 z-20 border-t border-line bg-white/95 backdrop-blur lg:left-72" style={{ bottom: "var(--action-bar-bottom)", paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Button variant="secondary" size="lg" onClick={onChangeClient}>
            <ArrowLeft className="size-6" /> <span className="hidden sm:inline">{t.common.back}</span>
          </Button>
          <p className="min-w-0 flex-1 text-right text-xl font-bold tabular">{value > 0 ? fmt.money(value) : ""}</p>
          <Button size="lg" variant="success" onClick={save} loading={saving} disabled={value <= 0 || value > total} data-tour="pay-save">
            <Wallet className="size-6" /> {t.pay.savePayment}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Done({
  amount,
  clientId,
  today,
  onAnother,
}: {
  amount: number;
  clientId: Id<"clients">;
  today: string;
  onAnother: () => void;
}) {
  const t = useT();
  const fmt = useFmt();
  const data = useQuery(api.clients.get, { clientId, today });
  const [printing, setPrinting] = useState(false);
  if (!data) return <PageLoading />;
  return (
    <div className="mx-auto max-w-xl py-4 text-center">
      <span className="mx-auto flex size-24 items-center justify-center rounded-full bg-[#E8F7EE] text-[#16A34A]">
        <CheckCircle2 className="size-14" />
      </span>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-ink">{t.pay.received(fmt.money(amount), data.client.name)}</h1>
      <p className="mt-2 text-xl font-semibold text-ink-2">{data.balance > 0 ? t.pay.left(fmt.money(data.balance)) : t.pay.allPaid}</p>
      <div className="mt-8 flex flex-col gap-3">
        {data.balance > 0 && (
          <Button size="lg" variant="secondary" onClick={() => setPrinting(true)}>
            <Printer className="size-6" /> {t.pay.printList}
          </Button>
        )}
        <Button size="lg" variant="secondary" onClick={onAnother}>
          <Wallet className="size-6" /> {t.pay.title}
        </Button>
        <LinkButton to="/" size="lg">
          <HomeIcon className="size-6" /> {t.flow.goHome}
        </LinkButton>
      </div>
      <PrintPreview
        open={printing}
        onClose={() => setPrinting(false)}
        title={t.pay.printList}
        render={(settings) => <StatementSlip settings={settings} data={data} today={today} />}
      />
    </div>
  );
}
