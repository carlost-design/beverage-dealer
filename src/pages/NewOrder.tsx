import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Coins,
  Home as HomeIcon,
  MessageSquarePlus,
  Pencil,
  Plus,
  Printer,
  Store,
  Tag,
  Truck,
  UserPlus,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import type { StockRow } from "../../convex/lib/dayView";
import { discountAmount } from "../../convex/lib/money";
import { ClientFormModal } from "../components/ClientFormModal";
import { DiscountFields, readDiscount, type DiscountDraft } from "../components/DiscountFields";
import { PrintPreview } from "../components/print";
import { ProductTile } from "../components/ProductTile";
import { OrderSlip } from "../components/receipts";
import { ClientName, PaymentBadge } from "../components/status";
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
  Stepper,
  Textarea,
} from "../components/ui";
import { useErrorMessage, useFmt, useT } from "../i18n";
import { cx, parsePeso, pesoInput } from "../lib/format";
import { addDays, useToday } from "../lib/useToday";

type ClientRow = NonNullable<ReturnType<typeof useClientList>>[number];
type ExistingOrder = NonNullable<ReturnType<typeof useOrder>>;
type Line = { quantity: number; empties: number; emptiesTouched: boolean };
type Method = "cash" | "gcash" | "maya" | "bank" | "check";
type PayMode = "later" | "full" | "part";

function useClientList(today: string) {
  return useQuery(api.clients.list, { today });
}
function useOrder(orderId: string | undefined, today: string) {
  return useQuery(api.orders.get, orderId ? { orderId, today } : "skip");
}

export default function NewOrder() {
  const t = useT();
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [round, setRound] = useState(0);
  const today = useToday();
  const products = useQuery(api.products.list);
  const clients = useClientList(today);
  const stock = useQuery(api.inventory.day, { date: today });
  const existing = useOrder(orderId, today);

  if (!products || !clients || !stock || (orderId && existing === undefined)) return <PageLoading />;
  if (orderId && !existing) {
    return <EmptyState title={t.order.notFound} action={<LinkButton to="/orders">{t.order.backToOrders}</LinkButton>} />;
  }
  if (existing && !existing.canEditItems) {
    return (
      <EmptyState
        title={t.order.cantEditTitle}
        action={<LinkButton to={`/orders/${existing.order._id}`}>{t.flow.viewOrder}</LinkButton>}
      >
        {t.order.cantEditBody}
      </EmptyState>
    );
  }
  return (
    <OrderFlow
      key={`${existing?.order._id ?? "new"}-${round}`}
      onRestart={() => {
        setRound((r) => r + 1);
        navigate("/orders/new");
        window.scrollTo(0, 0);
      }}
      today={today}
      products={products.filter((p) => p.active || existing?.order.items.some((i) => i.productId === p._id))}
      clients={clients}
      stockRows={stock.rows}
      dayClosed={stock.status === "closed"}
      existing={existing ?? undefined}
    />
  );
}

function draftFrom(rule: { type: DiscountDraft["type"]; value: number } | undefined): DiscountDraft {
  if (!rule || rule.type === "none") return { type: "none", value: "" };
  return { type: rule.type, value: rule.type === "percent" ? String(rule.value) : pesoInput(rule.value) };
}

function OrderFlow({
  today,
  products,
  clients,
  stockRows,
  dayClosed,
  existing,
  onRestart,
}: {
  today: string;
  products: Doc<"products">[];
  clients: ClientRow[];
  stockRows: StockRow[];
  dayClosed: boolean;
  existing?: ExistingOrder;
  onRestart: () => void;
}) {
  const t = useT();
  const fmt = useFmt();
  const errorMessage = useErrorMessage();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const createOrder = useMutation(api.orders.create);
  const updateItems = useMutation(api.orders.update);
  const updateDetails = useMutation(api.orders.updateDetails);
  const order = existing?.order;
  const editing = Boolean(order);

  const preselected = order
    ? clients.find((c) => c._id === order.clientId)
    : clients.find((c) => c._id === params.get("client") && c.active);

  const [clientId, setClientId] = useState<Id<"clients"> | null>(preselected?._id ?? null);
  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">(order?.fulfillment ?? "delivery");
  const [takingNow, setTakingNow] = useState(true);
  const [address, setAddress] = useState(order?.deliveryAddress ?? preselected?.address ?? "");
  const [lines, setLines] = useState<Record<string, Line>>(() =>
    Object.fromEntries(
      (order?.items ?? []).map((item) => [
        item.productId,
        // Lines where every empty came back keep following the case count.
        { quantity: item.quantity, empties: item.emptiesReturned, emptiesTouched: item.emptiesReturned !== item.quantity },
      ]),
    ),
  );
  const [discount, setDiscount] = useState<DiscountDraft>(() => draftFrom(order ? order.discount : preselected?.discount));
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountNote, setDiscountNote] = useState(order?.discount?.note ?? "");
  const [notes, setNotes] = useState(order?.notes ?? "");
  const [noteOpen, setNoteOpen] = useState(Boolean(order?.notes));
  const [payMode, setPayMode] = useState<PayMode>("later");
  const [payAmount, setPayAmount] = useState("");
  const [method, setMethod] = useState<Method>("cash");
  const [reference, setReference] = useState("");
  const [search, setSearch] = useState("");
  const [addingClient, setAddingClient] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<Id<"orders"> | null>(null);

  const client = clients.find((c) => c._id === clientId);
  const stockByProduct = useMemo(() => new Map(stockRows.map((row) => [row.productId, row])), [stockRows]);
  const onOrder = (productId: string) => order?.items.find((i) => i.productId === productId)?.quantity ?? 0;
  const available = (productId: Id<"products">) => (stockByProduct.get(productId)?.expected ?? 0) + onOrder(productId);
  const priceOf = (product: Doc<"products">) => order?.items.find((i) => i.productId === product._id)?.price ?? product.price;

  const chosen = products
    .map((product) => ({ product, line: lines[product._id] }))
    .filter(({ line }) => line && (line.quantity > 0 || line.empties > 0));
  const subtotal = chosen.reduce((sum, { product, line }) => sum + priceOf(product) * line.quantity, 0);
  const cases = chosen.reduce((sum, { line }) => sum + line.quantity, 0);
  const rule = readDiscount(discount);
  const discountValue = rule ? discountAmount(rule, subtotal, cases) : 0;
  const total = subtotal - discountValue;
  const emptiesOwed = chosen
    .filter(({ product }) => product.returnable)
    .reduce((sum, { line }) => sum + line.quantity - line.empties, 0);
  const overStock = chosen.filter(({ product, line }) => line.quantity > available(product._id));
  const orderDate = order?.date ?? today;
  const balanceBefore = client ? client.balance - (order ? order.total - order.amountPaid : 0) : 0;
  const overLimit = client?.creditLimit !== undefined && balanceBefore + total > client.creditLimit;
  const paid = payMode === "full" ? total : payMode === "part" ? parsePeso(payAmount) : 0;

  // Steps: new orders start by choosing the client; edits skip that step.
  const steps = editing ? (["cases", "details", "review"] as const) : (["client", "cases", "details", "review"] as const);
  type StepName = (typeof steps)[number];
  const reachable = (name: StepName) => {
    if (name === "client") return true;
    if (!client) return false;
    if (name === "cases") return true;
    return cases > 0 && overStock.length === 0;
  };
  const requested = Math.max(1, Math.min(steps.length, Number(params.get("step") ?? (preselected && !editing ? 2 : 1)) || 1));
  let stepIndex = requested - 1;
  while (stepIndex > 0 && !reachable(steps[stepIndex])) stepIndex--;
  const step = steps[stepIndex];

  function goTo(index: number) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("step", String(index + 1));
      return next;
    });
    window.scrollTo(0, 0);
  }

  function chooseClient(id: Id<"clients">) {
    const next = clients.find((c) => c._id === id);
    setClientId(id);
    if (next) {
      setAddress(next.address ?? "");
      setDiscount(draftFrom(next.discount));
      setDiscountNote("");
    }
    goTo(1);
  }

  function setLine(product: Doc<"products">, change: Partial<Line>) {
    setLines((current) => {
      const line = current[product._id] ?? { quantity: 0, empties: 0, emptiesTouched: false };
      const next = { ...line, ...change };
      // Empty cases follow the case count until someone changes them by hand.
      if (change.quantity !== undefined && !next.emptiesTouched) {
        next.empties = product.returnable ? change.quantity : 0;
      }
      return { ...current, [product._id]: next };
    });
  }

  function problem(): string | null {
    if (step === "client" && !client) return t.flow.chooseClient;
    if (step === "cases") {
      if (cases === 0) return t.flow.addCases;
      if (overStock.length) return t.flow.notEnoughStock(overStock.map((i) => i.product.name).join(", "));
    }
    if (step === "details") {
      if (rule === null) return t.discount.checkAmount;
      if (payMode === "part" && (paid === null || paid <= 0 || paid >= total)) return t.flow.partialAmount;
    }
    if (step === "review" && dayClosed) return t.flow.dayClosed;
    return null;
  }

  function next() {
    const issue = problem();
    if (issue) return toast.error(issue);
    goTo(stepIndex + 1);
  }

  async function save() {
    const issue = problem();
    if (issue || !client) return toast.error(issue ?? t.flow.chooseClient);
    const items = chosen.map(({ product, line }) => ({
      productId: product._id,
      quantity: line.quantity,
      emptiesReturned: product.returnable ? line.empties : 0,
    }));
    const discountInput = rule ? { ...rule, note: discountNote } : undefined;
    setSaving(true);
    try {
      if (order) {
        await updateItems({ orderId: order._id, items, discount: discountInput });
        await updateDetails({ orderId: order._id, fulfillment, deliveryAddress: address, notes });
        toast.success(t.order.saved);
        navigate(`/orders/${order._id}`);
      } else {
        const id = await createOrder({
          clientId: client._id,
          fulfillment,
          completed: fulfillment === "pickup" && takingNow,
          deliveryAddress: fulfillment === "delivery" ? address : undefined,
          items,
          discount: discountInput,
          notes,
          payment: payMode !== "later" && paid ? { amount: paid, method, reference } : undefined,
        });
        setSavedId(id);
        window.scrollTo(0, 0);
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (savedId) return <Saved orderId={savedId} today={today} onRestart={onRestart} />;

  const term = search.trim().toLowerCase();
  const title =
    step === "client"
      ? t.flow.whoIsOrdering
      : step === "cases"
        ? t.flow.howManyCases
        : step === "details"
          ? t.flow.deliveryAndPayment
          : t.flow.checkAndSave;

  return (
    <div className="mx-auto max-w-3xl pb-40 lg:pb-28">
      <p className="mb-4 text-lg font-semibold text-ink-3">{editing && order ? t.flow.editOrder(order.orderNo) : t.flow.newOrder}</p>
      <StepHeader step={stepIndex + 1} of={steps.length} title={title} />

      {dayClosed && (
        <div className="mb-5">
          <Alert tone="red" icon={AlertTriangle} title={t.flow.dayClosed} />
        </div>
      )}

      {step !== "client" && client && (
        <div className="mb-5 space-y-3">
          <Card className="flex items-center gap-4 p-4">
            <Avatar name={client.name} late={client.daysLate > 0} />
            <div className="min-w-0 flex-1">
              <ClientName name={client.name} isLate={client.daysLate > 0} className="block text-lg break-words" />
              <p className="text-sm text-ink-3">
                {[client.storeName, fmt.terms(client.termsDays)].filter(Boolean).join(" · ")}
              </p>
            </div>
            {!editing && (
              <Button variant="secondary" size="sm" onClick={() => goTo(0)}>
                <Pencil className="size-4" /> {t.common.change}
              </Button>
            )}
          </Card>
          {client.daysLate > 0 && (
            <Alert tone="red" icon={AlertTriangle} title={t.flow.lateWarning(client.name, fmt.money(client.lateBalance), client.daysLate)} />
          )}
          {overLimit && client.creditLimit !== undefined && (
            <Alert
              tone="amber"
              icon={AlertTriangle}
              title={t.flow.overLimit(client.name, fmt.money(client.creditLimit), fmt.money(balanceBefore + total))}
            />
          )}
        </div>
      )}

      {step === "client" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <SearchField value={search} onChange={setSearch} placeholder={t.flow.typeName} className="flex-1" />
            <Button variant="secondary" onClick={() => setAddingClient(true)}>
              <UserPlus className="size-5" /> {t.flow.newClient}
            </Button>
          </div>
          <ClientChoices
            clients={clients.filter(
              (c) => c.active && (!term || `${c.name} ${c.storeName ?? ""}`.toLowerCase().includes(term)),
            )}
            selected={clientId}
            onSelect={chooseClient}
            emptyText={term ? t.flow.noClientMatch(search.trim()) : t.clients.emptyFirst}
          />
        </div>
      )}

      {step === "cases" && (
        <div className="space-y-4">
          {products.length > 8 && <SearchField value={search} onChange={setSearch} placeholder={t.flow.findProduct} />}
          {products.length === 0 ? (
            <Card>
              <EmptyState title={t.flow.noProducts} action={<LinkButton to="/products">{t.stock.addProducts}</LinkButton>} />
            </Card>
          ) : (
            (["softdrinks", "beer", "other"] as const).map((category) => {
              const group = products.filter((p) => p.category === category && (!term || p.name.toLowerCase().includes(term)));
              if (group.length === 0) return null;
              return (
                <Card key={category}>
                  <p className="px-5 pt-4 text-base font-bold tracking-wide text-ink-3 uppercase sm:px-6">{fmt.category(category)}</p>
                  <ul className="divide-y divide-line">
                    {group.map((product) => (
                      <ProductLine
                        key={product._id}
                        product={product}
                        price={priceOf(product)}
                        line={lines[product._id]}
                        available={available(product._id)}
                        onChange={(change) => setLine(product, change)}
                      />
                    ))}
                  </ul>
                </Card>
              );
            })
          )}
        </div>
      )}

      {step === "details" && (
        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <h2 className="mb-4 text-xl font-bold text-ink">{t.flow.howGetIt}</h2>
            <ChoiceCards
              label={t.flow.howGetIt}
              value={fulfillment}
              onChange={setFulfillment}
              options={[
                { value: "delivery", label: t.flow.deliver, icon: Truck, tone: "blue" },
                { value: "pickup", label: t.flow.pickup, icon: Store, tone: "violet" },
              ]}
            />
            {fulfillment === "delivery" ? (
              <Field label={t.flow.deliverTo} className="mt-4">
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t.flow.addressPlaceholder} />
              </Field>
            ) : (
              !editing && (
                <label className="mt-4 flex min-h-14 items-center gap-3 rounded-2xl border border-line px-4">
                  <input type="checkbox" checked={takingNow} onChange={(e) => setTakingNow(e.target.checked)} className="size-6 rounded accent-brand" />
                  <span className="text-base font-semibold text-ink">{t.flow.takingNow}</span>
                </label>
              )
            )}
          </Card>

          {!editing && (
            <Card className="p-5 sm:p-6">
              <h2 className="mb-4 text-xl font-bold text-ink">{t.flow.howPaying}</h2>
              <ChoiceCards
                label={t.flow.howPaying}
                value={payMode}
                onChange={setPayMode}
                columns={3}
                options={[
                  { value: "later", label: t.flow.payLater, icon: Clock, tone: "amber" },
                  { value: "full", label: t.flow.payFull, icon: CheckCircle2, tone: "green" },
                  { value: "part", label: t.flow.payPart, icon: Coins, tone: "blue" },
                ]}
              />
              {payMode !== "later" && (
                <div className="mt-5 space-y-4">
                  {payMode === "part" && (
                    <Field label={t.flow.amountReceived}>
                      <PesoInput value={payAmount} onChange={setPayAmount} placeholder={pesoInput(total)} />
                    </Field>
                  )}
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
                </div>
              )}
            </Card>
          )}

          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-[#E8F7EE] text-[#16A34A]">
                  <Tag className="size-6" />
                </span>
                <div>
                  <p className="text-xl font-bold text-ink">{t.flow.discount}</p>
                  <p className="text-base text-ink-3">
                    {rule ? fmt.discount(rule) : client?.discount ? t.flow.usualDiscount(fmt.discount(client.discount)) : t.flow.noUsualDiscount}
                  </p>
                </div>
              </div>
              {!discountOpen && (
                <Button variant="secondary" size="sm" onClick={() => setDiscountOpen(true)}>
                  <Pencil className="size-4" /> {t.flow.changeDiscount}
                </Button>
              )}
            </div>
            {discountOpen && (
              <div className="mt-4 space-y-4">
                <DiscountFields label={t.flow.discount} value={discount} onChange={setDiscount} />
                {rule && (
                  <Field label={t.flow.discountReason} hint={t.common.optional}>
                    <Input value={discountNote} onChange={(e) => setDiscountNote(e.target.value)} />
                  </Field>
                )}
              </div>
            )}
          </Card>

          <Card className="p-5 sm:p-6">
            {noteOpen ? (
              <Field label={t.flow.note} hint={t.common.optional}>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} autoFocus />
              </Field>
            ) : (
              <Button variant="ghost" onClick={() => setNoteOpen(true)}>
                <MessageSquarePlus className="size-5" /> {t.flow.addNote}
              </Button>
            )}
          </Card>
        </div>
      )}

      {step === "review" && client && (
        <Card className="overflow-hidden">
          <div className="px-5 pt-5 sm:px-6">
            <p className="text-base font-semibold text-ink-3">{t.flow.items}</p>
          </div>
          <ul className="divide-y divide-line px-5 sm:px-6">
            {chosen
              .filter(({ line }) => line.quantity > 0)
              .map(({ product, line }) => (
                <li key={product._id} className="flex items-center gap-3 py-3.5">
                  <ProductTile category={product.category} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold text-ink">{product.name}</p>
                    <p className="text-base text-ink-3 tabular">
                      {t.common.cases(line.quantity)} × {fmt.money(priceOf(product))}
                    </p>
                  </div>
                  <p className="text-lg font-bold tabular">{fmt.money(priceOf(product) * line.quantity)}</p>
                </li>
              ))}
          </ul>
          <dl className="space-y-2 border-t border-line px-5 py-4 text-lg sm:px-6">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-3">{t.flow.subtotal}</dt>
              <dd className="font-semibold tabular">{fmt.money(subtotal)}</dd>
            </div>
            {discountValue > 0 && rule && (
              <div className="flex justify-between gap-3 text-[#146C43]">
                <dt>
                  {t.flow.discount} ({fmt.discount(rule)})
                </dt>
                <dd className="font-semibold tabular">−{fmt.money(discountValue)}</dd>
              </div>
            )}
          </dl>
          <div className="flex items-baseline justify-between gap-3 bg-brand-soft px-5 py-5 sm:px-6">
            <span className="text-xl font-bold text-ink">{t.flow.total}</span>
            <span className="text-[2.5rem] leading-none font-bold tracking-tight text-ink tabular">{fmt.money(total)}</span>
          </div>
          <ul className="space-y-2.5 px-5 py-5 text-base sm:px-6">
            {!editing && (
              <li className="flex items-start gap-3">
                <Coins className="mt-0.5 size-6 shrink-0 text-ink-3" />
                <span>
                  {payMode === "later"
                    ? t.flow.utangNote
                    : t.flow.paidNow(fmt.money(paid ?? 0), t.methods[method])}
                  {payMode !== "full" &&
                    (client.termsDays === 0
                      ? ` ${t.flow.payOnDelivery}`
                      : ` ${t.flow.due(fmt.date(addDays(orderDate, client.termsDays)))}.`)}
                </span>
              </li>
            )}
            <li className="flex items-start gap-3">
              {fulfillment === "delivery" ? <Truck className="mt-0.5 size-6 shrink-0 text-ink-3" /> : <Store className="mt-0.5 size-6 shrink-0 text-ink-3" />}
              <span>{fulfillment === "delivery" ? `${t.flow.deliver}: ${address || "—"}` : t.flow.pickup}</span>
            </li>
            {chosen.some(({ product }) => product.returnable) && (
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-ink-3" />
                <span>
                  {emptiesOwed > 0 ? t.flow.emptiesOwe(emptiesOwed) : emptiesOwed < 0 ? t.flow.emptiesExtra(-emptiesOwed) : t.flow.emptiesAll}
                </span>
              </li>
            )}
            {notes.trim() && (
              <li className="flex items-start gap-3">
                <MessageSquarePlus className="mt-0.5 size-6 shrink-0 text-ink-3" />
                <span>{notes}</span>
              </li>
            )}
          </ul>
        </Card>
      )}

      {/* Back / next, always in the same place */}
      <div
        className="fixed inset-x-0 z-20 border-t border-line bg-white/95 backdrop-blur lg:left-72"
        style={{ bottom: "var(--action-bar-bottom)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          {stepIndex > 0 ? (
            <Button variant="secondary" size="lg" onClick={() => goTo(stepIndex - 1)}>
              <ArrowLeft className="size-6" /> <span className="hidden sm:inline">{t.common.back}</span>
            </Button>
          ) : (
            <LinkButton to="/" variant="secondary" size="lg" aria-label={t.flow.goHome}>
              <ArrowLeft className="size-6" /> <span className="hidden sm:inline">{t.common.back}</span>
            </LinkButton>
          )}
          <div className="min-w-0 flex-1 text-right">
            {cases > 0 && (
              <>
                <p className="text-sm text-ink-3">{t.flow.casesCount(cases)}</p>
                <p className="text-xl font-bold tabular">{fmt.money(total)}</p>
              </>
            )}
          </div>
          {step === "review" ? (
            <Button size="lg" variant="success" onClick={save} loading={saving} disabled={dayClosed}>
              <CheckCircle2 className="size-6" /> {editing ? t.common.saveChanges : t.flow.saveOrder}
            </Button>
          ) : step === "client" ? null : (
            <Button size="lg" onClick={next}>
              {t.common.next} <ArrowRight className="size-6" />
            </Button>
          )}
        </div>
      </div>

      <ClientFormModal open={addingClient} onClose={() => setAddingClient(false)} onSaved={chooseClient} />
    </div>
  );
}

function ClientChoices({
  clients,
  selected,
  onSelect,
  emptyText,
}: {
  clients: ClientRow[];
  selected: Id<"clients"> | null;
  onSelect: (id: Id<"clients">) => void;
  emptyText: string;
}) {
  const t = useT();
  const fmt = useFmt();
  if (clients.length === 0) {
    return (
      <Card>
        <EmptyState title={emptyText} />
      </Card>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {clients.map((c) => {
        const late = c.daysLate > 0;
        return (
          <li key={c._id}>
            <button
              type="button"
              onClick={() => onSelect(c._id)}
              className={cx(
                "flex w-full items-center gap-3 rounded-2xl border-2 bg-white p-4 text-left shadow-card transition-colors",
                selected === c._id ? "border-brand bg-brand-soft" : late ? "border-red-200 hover:border-red-300" : "border-transparent hover:border-line-strong",
              )}
            >
              <Avatar name={c.name} late={late} />
              <span className="min-w-0 flex-1">
                <ClientName name={c.name} isLate={late} className="block truncate text-lg" />
                <span className="block truncate text-sm text-ink-3">{c.storeName ?? fmt.terms(c.termsDays)}</span>
              </span>
              {(c.balance > 0 || late) && (
                <span className="flex flex-col items-end gap-1">
                  {c.balance > 0 && <span className={cx("text-base font-bold tabular", late && "text-[#B42318]")}>{fmt.money(c.balance)}</span>}
                  {late && (
                    <Chip tone="red" solid>
                      {t.status.late(c.daysLate)}
                    </Chip>
                  )}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ProductLine({
  product,
  price,
  line,
  available,
  onChange,
}: {
  product: Doc<"products">;
  price: number;
  line?: Line;
  available: number;
  onChange: (change: Partial<Line>) => void;
}) {
  const t = useT();
  const fmt = useFmt();
  const quantity = line?.quantity ?? 0;
  const empties = line?.empties ?? 0;
  const out = available <= 0;
  const low = !out && product.lowStockLevel > 0 && available <= product.lowStockLevel;
  return (
    <li className={cx("px-5 py-4 sm:px-6", quantity > 0 && "bg-brand-soft/60")}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <ProductTile category={product.category} />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold text-ink">{product.name}</p>
          <p className="text-base text-ink-3">
            <span className="font-semibold text-ink-2 tabular">{fmt.money(price)}</span> {t.flow.perCase} ·{" "}
            <span className={cx("font-semibold", out ? "text-[#B42318]" : low ? "text-[#93370D]" : "text-ink-2")}>
              {out ? t.flow.outOfStock : t.flow.left(available)}
            </span>
          </p>
          {quantity > available && <p className="text-base font-semibold text-[#B42318]">{t.flow.onlyLeft(Math.max(available, 0))}</p>}
        </div>
        <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:flex-col sm:items-end">
          <Stepper value={quantity} onChange={(q) => onChange({ quantity: q })} max={Math.max(available, quantity)} label={product.name} />
          {quantity > 0 && <span className="text-lg font-bold tabular">{fmt.money(price * quantity)}</span>}
        </div>
      </div>
      {product.returnable && (quantity > 0 || empties > 0) && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-4 py-2.5 sm:justify-end">
          <span className="text-base font-semibold text-ink-2">{t.flow.emptiesReturned}</span>
          <Stepper
            size="sm"
            value={empties}
            onChange={(e) => onChange({ empties: e, emptiesTouched: true })}
            label={`${t.flow.emptiesReturned}: ${product.name}`}
          />
        </div>
      )}
    </li>
  );
}

function Saved({ orderId, today, onRestart }: { orderId: Id<"orders">; today: string; onRestart: () => void }) {
  const t = useT();
  const fmt = useFmt();
  const data = useQuery(api.orders.get, { orderId, today });
  const [printing, setPrinting] = useState(false);
  if (!data) return <PageLoading />;
  const { order, client, payments } = data;
  return (
    <div className="mx-auto max-w-xl py-4 text-center">
      <span className="mx-auto flex size-24 items-center justify-center rounded-full bg-[#E8F7EE] text-[#16A34A]">
        <CheckCircle2 className="size-14" strokeWidth={2} />
      </span>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-ink">{t.flow.saved(order.orderNo)}</h1>
      <p className="mt-2 text-lg text-ink-3">{t.flow.savedHint}</p>
      <Card className="mt-6 p-5 text-left">
        <div className="flex items-center gap-3">
          {client && <Avatar name={client.name} />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold">{client?.name}</p>
            <PaymentBadge status={order.paymentStatus} />
          </div>
          <p className="text-2xl font-bold tabular">{fmt.money(order.total)}</p>
        </div>
      </Card>
      <div className="mt-6 flex flex-col gap-3">
        <Button size="lg" onClick={() => setPrinting(true)}>
          <Printer className="size-6" /> {t.flow.printReceipt}
        </Button>
        <Button variant="secondary" size="lg" onClick={onRestart}>
          <Plus className="size-6" /> {t.flow.anotherOrder}
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <LinkButton to="/" variant="ghost" size="lg">
            <HomeIcon className="size-6" /> {t.flow.goHome}
          </LinkButton>
          <LinkButton to={`/orders/${order._id}`} variant="ghost" size="lg">
            {t.flow.viewOrder}
          </LinkButton>
        </div>
      </div>
      <PrintPreview
        open={printing}
        onClose={() => setPrinting(false)}
        title={t.orders.orderNo(order.orderNo)}
        render={(settings) => <OrderSlip settings={settings} order={order} client={client} payments={payments} />}
      />
    </div>
  );
}
