import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Archive, ArchiveRestore, HandCoins, Package, Pencil, Phone, Plus, Printer, Wallet } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { ClientFormModal } from "../components/ClientFormModal";
import { PrintPreview } from "../components/print";
import { StatementSlip } from "../components/receipts";
import { ClientName, PaymentBadge } from "../components/status";
import {
  Alert,
  Avatar,
  BackLink,
  Button,
  Card,
  CardHeader,
  ChoiceCards,
  EmptyState,
  Field,
  Input,
  LinkButton,
  Modal,
  PageLoading,
  Select,
  StatCard,
  Stepper,
} from "../components/ui";
import { useErrorMessage, useFmt, useT } from "../i18n";
import { cx } from "../lib/format";
import { useToday } from "../lib/useToday";

export default function ClientDetail() {
  const t = useT();
  const fmt = useFmt();
  const errorMessage = useErrorMessage();
  const { clientId } = useParams();
  const today = useToday();
  const data = useQuery(api.clients.get, clientId ? { clientId, today } : "skip");
  const products = useQuery(api.products.list);
  const setActive = useMutation(api.clients.setActive);
  const [editing, setEditing] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [returning, setReturning] = useState(false);
  const [adjusting, setAdjusting] = useState(false);

  if (data === undefined || !products) return <PageLoading />;
  if (data === null) {
    return <EmptyState title={t.clients.notFound} action={<LinkButton to="/clients">{t.clients.backToClients}</LinkButton>} />;
  }
  const { client } = data;
  const isLate = data.daysLate > 0;
  const returnable = products.filter((p) => p.returnable && p.active);
  const creditUse = client.creditLimit ? Math.min(1, data.balance / client.creditLimit) : 0;

  async function toggleArchive() {
    try {
      await setActive({ clientId: client._id, active: !client.active });
      toast.success(client.active ? t.clients.archivedToast : t.clients.restoredToast);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <>
      <BackLink to="/clients" label={t.nav.clients} />
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Avatar name={client.name} late={isLate} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold tracking-tight">
            <ClientName name={client.name} isLate={isLate} />
          </h1>
          {client.storeName && <p className="mt-1 text-lg text-ink-3">{client.storeName}</p>}
        </div>
        <div className="flex flex-wrap gap-3">
          {client.active && (
            <LinkButton to={`/orders/new?client=${client._id}`} size="lg">
              <Plus className="size-6" /> {t.clients.newOrder}
            </LinkButton>
          )}
          {data.balance > 0 && (
            <LinkButton to={`/payments/new?client=${client._id}`} variant="success" size="lg">
              <Wallet className="size-6" /> {t.clients.receivePayment}
            </LinkButton>
          )}
          <Button variant="secondary" size="lg" onClick={() => setPrinting(true)}>
            <Printer className="size-6" /> {t.clients.printList}
          </Button>
        </div>
      </div>

      <div className="mb-5 space-y-3">
        {!client.active && (
          <Alert tone="amber" title={t.clients.archivedTitle} action={<Button variant="secondary" onClick={toggleArchive}>{t.clients.restore}</Button>}>
            {t.clients.archivedHint}
          </Alert>
        )}
        {isLate && (
          <Alert tone="red" icon={AlertTriangle} title={t.clients.lateTitle(data.daysLate)}>
            {t.clients.lateHint(fmt.money(data.lateBalance), fmt.money(data.balance))}
          </Alert>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title={t.clients.utang} icon={HandCoins} tone="orange" value={fmt.moneyWhole(data.balance)} caption={t.clients.unpaidOrders(data.openOrders.length)} />
        <StatCard
          title={t.clients.overdue}
          icon={AlertTriangle}
          tone="red"
          value={fmt.moneyWhole(data.lateBalance)}
          valueTone={isLate ? "red" : "default"}
          caption={isLate ? t.clients.oldestLate(data.daysLate) : t.clients.nothingOverdue}
        />
        <StatCard title={t.clients.emptiesToReturn} icon={Package} tone="blue" value={t.common.cases(data.emptiesOwed)} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title={t.clients.unpaidTitle} description={t.clients.unpaidHint} />
            {data.openOrders.length === 0 ? (
              <p className="px-6 pb-6 text-lg font-semibold text-[#146C43]">{t.clients.allPaid}</p>
            ) : (
              <ul className="divide-y divide-line p-2">
                {data.openOrders.map((order) => (
                  <li key={order._id}>
                    <Link
                      to={`/orders/${order._id}`}
                      className={cx(
                        "flex flex-wrap items-center gap-3 rounded-xl px-3 py-3.5",
                        order.isLate ? "bg-[#FEF3F2] hover:bg-[#FDE8E6]" : "hover:bg-gray-50",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-lg font-semibold text-ink">
                          #{order.orderNo} <span className="font-normal text-ink-3">· {fmt.shortDate(order.date)}</span>
                        </p>
                        <p className={cx("text-base", order.isLate ? "font-bold text-[#B42318]" : "text-ink-3")}>{t.orders.due(fmt.date(order.dueDate))}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={cx("text-xl font-bold tabular", order.isLate && "text-[#B42318]")}>{fmt.money(order.balance)}</span>
                        <PaymentBadge status={order.paymentStatus} isLate={order.isLate} daysLate={order.daysLate} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title={t.clients.recentOrders} />
            {data.recentOrders.length === 0 ? (
              <p className="px-6 pb-6 text-base text-ink-3">{t.clients.noOrders}</p>
            ) : (
              <ul className="divide-y divide-line p-2">
                {data.recentOrders.map((order) => (
                  <li key={order._id}>
                    <Link
                      to={`/orders/${order._id}`}
                      className={cx("flex flex-wrap items-center justify-between gap-3 rounded-xl px-3 py-3 hover:bg-gray-50", order.voided && "opacity-60")}
                    >
                      <span className="text-base">
                        <span className="font-semibold text-ink">#{order.orderNo}</span>{" "}
                        <span className="text-ink-3">
                          · {fmt.shortDate(order.date)} · {t.common.cases(order.cases)}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className={cx("text-base font-bold tabular", order.voided && "line-through")}>{fmt.money(order.total)}</span>
                        <PaymentBadge status={order.paymentStatus} isLate={order.isLate} daysLate={order.daysLate} voided={order.voided} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title={t.clients.recentPayments} />
            {data.payments.length === 0 ? (
              <p className="px-6 pb-6 text-base text-ink-3">{t.clients.noPayments}</p>
            ) : (
              <ul className="divide-y divide-line px-5 pb-2 sm:px-6">
                {data.payments.map((payment) => (
                  <li key={payment._id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-base">
                    <span className={cx(payment.voided && "text-gray-400 line-through")}>
                      {fmt.shortDate(payment.date)} · {fmt.method(payment.method)} · {t.clients.forOrder(payment.orderNo)}
                    </span>
                    <span className={cx("font-bold tabular", payment.voided && "text-gray-400 line-through")}>{fmt.money(payment.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-lg font-semibold text-ink">{t.clients.details}</p>
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="size-4" /> {t.common.edit}
              </Button>
            </div>
            <dl className="space-y-4 text-base">
              {client.phone && (
                <Detail label={t.clients.phone}>
                  <a
                    href={`tel:${client.phone.replace(/\s/g, "")}`}
                    className="mt-1 flex h-12 items-center justify-center gap-2 rounded-full border border-line-strong font-semibold text-ink hover:bg-gray-50"
                  >
                    <Phone className="size-5" /> {t.clients.call} · {client.phone}
                  </a>
                </Detail>
              )}
              {client.address && <Detail label={t.clients.address}>{client.address}</Detail>}
              <Detail label={t.clients.terms}>{fmt.terms(client.termsDays)}</Detail>
              <Detail label={t.clients.usualDiscount}>{client.discount ? fmt.discount(client.discount) : t.clients.none}</Detail>
              <Detail label={t.clients.creditLimit}>
                {client.creditLimit ? (
                  <>
                    {fmt.money(client.creditLimit)}
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={cx("h-full rounded-full", creditUse >= 1 ? "bg-red-500" : creditUse > 0.8 ? "bg-amber-500" : "bg-brand")}
                        style={{ width: `${creditUse * 100}%` }}
                      />
                    </div>
                    <p className="mt-1 text-sm text-ink-3">{t.clients.used(Math.round(creditUse * 100))}</p>
                  </>
                ) : (
                  t.clients.noLimit
                )}
              </Detail>
              {client.notes && <Detail label={t.clients.notes}>{client.notes}</Detail>}
            </dl>
          </Card>

          <Card>
            <CardHeader
              title={t.clients.emptiesTitle}
              description={t.clients.emptiesHint}
              action={
                returnable.length > 0 ? (
                  <Button variant="secondary" size="sm" onClick={() => setReturning(true)}>
                    {t.clients.returnEmpties}
                  </Button>
                ) : undefined
              }
            />
            {data.empties.length === 0 ? (
              <p className="px-6 pb-4 text-base text-ink-3">{t.clients.noEmpties}</p>
            ) : (
              <ul className="divide-y divide-line px-5 sm:px-6">
                {data.empties.map((row) => (
                  <li key={row.productId} className="flex justify-between gap-3 py-2.5 text-base">
                    <span className="text-ink-2">{row.name}</span>
                    <span className="font-bold tabular">{row.owed > 0 ? t.clients.owes(row.owed) : t.clients.extraReturned(-row.owed)}</span>
                  </li>
                ))}
              </ul>
            )}
            {returnable.length > 0 && (
              <div className="border-t border-line px-3 py-2">
                <Button variant="ghost" size="sm" className="h-auto min-h-10 whitespace-normal text-left" onClick={() => setAdjusting(true)}>
                  {t.clients.adjustEmpties}
                </Button>
              </div>
            )}
          </Card>

          <Button variant="ghost" className="w-full" onClick={toggleArchive}>
            {client.active ? (
              <>
                <Archive className="size-5" /> {t.clients.archive}
              </>
            ) : (
              <>
                <ArchiveRestore className="size-5" /> {t.clients.restoreClient}
              </>
            )}
          </Button>
        </div>
      </div>

      <ClientFormModal open={editing} onClose={() => setEditing(false)} client={client} />
      <PrintPreview
        open={printing}
        onClose={() => setPrinting(false)}
        title={t.clients.printList}
        render={(settings) => <StatementSlip settings={settings} data={data} today={today} />}
      />
      {returning && (
        <ReturnEmptiesModal
          clientId={client._id}
          products={returnable}
          owed={Object.fromEntries(data.empties.map((row) => [row.productId, row.owed]))}
          onClose={() => setReturning(false)}
        />
      )}
      {adjusting && <AdjustEmptiesModal clientId={client._id} products={returnable} onClose={() => setAdjusting(false)} />}
    </>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-base text-ink">{children}</dd>
    </div>
  );
}

function ReturnEmptiesModal({
  clientId,
  products,
  owed,
  onClose,
}: {
  clientId: Id<"clients">;
  products: { _id: Id<"products">; name: string }[];
  owed: Record<string, number>;
  onClose: () => void;
}) {
  const t = useT();
  const errorMessage = useErrorMessage();
  const returnEmpties = useMutation(api.clients.returnEmpties);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const sorted = [...products].sort((a, b) => (owed[b._id] ?? 0) - (owed[a._id] ?? 0));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const items = Object.entries(counts)
      .filter(([, quantity]) => quantity > 0)
      .map(([productId, quantity]) => ({ productId: productId as Id<"products">, quantity }));
    if (items.length === 0) return toast.error(t.clients.returnNone);
    setSaving(true);
    try {
      await returnEmpties({ clientId, items });
      toast.success(t.clients.returnSaved);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t.clients.returnTitle} description={t.clients.returnHint}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <ul className="divide-y divide-line">
          {sorted.map((product) => (
            <li key={product._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-lg font-semibold text-ink">{product.name}</p>
                {(owed[product._id] ?? 0) > 0 && <p className="text-base text-ink-3">{t.clients.owesN(owed[product._id])}</p>}
              </div>
              <Stepper value={counts[product._id] ?? 0} onChange={(n) => setCounts((c) => ({ ...c, [product._id]: n }))} label={product.name} />
            </li>
          ))}
        </ul>
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

function AdjustEmptiesModal({
  clientId,
  products,
  onClose,
}: {
  clientId: Id<"clients">;
  products: { _id: Id<"products">; name: string }[];
  onClose: () => void;
}) {
  const t = useT();
  const errorMessage = useErrorMessage();
  const adjust = useMutation(api.clients.adjustEmpties);
  const [productId, setProductId] = useState(products[0]?._id ?? "");
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [quantity, setQuantity] = useState(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (quantity <= 0) return toast.error(t.clients.enterCases);
    if (!note.trim()) return toast.error(t.damage.needReason);
    setSaving(true);
    try {
      await adjust({ clientId, productId: productId as Id<"products">, delta: direction === "add" ? quantity : -quantity, note });
      toast.success(t.clients.adjustSaved);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t.clients.adjustTitle}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label={t.clients.product}>
          <Select value={productId} onChange={(e) => setProductId(e.target.value as Id<"products">)}>
            {products.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <ChoiceCards
          label={t.clients.changeLabel}
          value={direction}
          onChange={setDirection}
          options={[
            { value: "add", label: t.clients.owesMore },
            { value: "remove", label: t.clients.owesLess },
          ]}
        />
        <Field label={t.damage.cases}>
          <Stepper value={quantity} onChange={setQuantity} label={t.damage.cases} />
        </Field>
        <Field label={t.common.reason} hint={t.clients.adjustReasonHint}>
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
