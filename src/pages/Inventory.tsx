import { useMutation, useQuery } from "convex/react";
import {
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Info,
  PackageMinus,
  PackagePlus,
  Printer,
  RotateCcw,
  ShoppingCart,
  SlidersHorizontal,
  Truck,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { DateNav } from "../components/DateNav";
import { PrintPreview } from "../components/print";
import { ProductTile } from "../components/ProductTile";
import { DayReportSlip } from "../components/receipts";
import {
  Alert,
  Button,
  Card,
  CardHeader,
  ChoiceCards,
  Chip,
  EmptyState,
  Field,
  Input,
  LinkButton,
  Modal,
  PageHeader,
  PageLoading,
  Select,
  StatCard,
  Stepper,
} from "../components/ui";
import { useErrorMessage, useFmt, useT } from "../i18n";
import { cx } from "../lib/format";
import { useToday } from "../lib/useToday";
import { useTourPage } from "../tour/TourProvider";

export default function Inventory() {
  useTourPage("stock");
  const t = useT();
  const fmt = useFmt();
  const errorMessage = useErrorMessage();
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const date = params.get("date") ?? today;
  const isToday = date === today;
  const day = useQuery(api.inventory.day, { date });
  const recent = useQuery(api.inventory.recentDays);
  const orders = useQuery(api.orders.listByDate, { date, today });
  const payments = useQuery(api.payments.listByDate, { date });
  const products = useQuery(api.products.list);
  const reopen = useMutation(api.inventory.reopenDay);
  const navigate = useNavigate();
  const [modal, setModal] = useState<"damage" | "empties" | "print" | "reopen" | null>(null);
  const [showAll, setShowAll] = useState(false);
  // The product picked from a row, or "any" from the top button.
  const [adjustFor, setAdjustFor] = useState<Id<"products"> | "any" | null>(null);
  const [showActivity, setShowActivity] = useState(false);

  if (!day || !products) return <PageLoading />;
  const setDate = (next: string) => setParams(next === today ? {} : { date: next });
  const editable = isToday && day.status !== "closed";
  const closed = day.status === "closed";
  const activeOrders = (orders ?? []).filter((o) => !o.voided);
  const sales = activeOrders.reduce((sum, o) => sum + o.total, 0);
  const collected = (payments ?? []).reduce((sum, p) => sum + p.amount, 0);
  const totals = day.rows.reduce(
    (acc, row) => ({
      starting: acc.starting + row.starting,
      stockIn: acc.stockIn + row.stockIn,
      sold: acc.sold + row.sold,
      end: acc.end + (row.counted ?? row.expected),
    }),
    { starting: 0, stockIn: 0, sold: 0, end: 0 },
  );
  const status =
    day.status === "closed" ? (
      <Chip tone={day.counted ? "green" : "amber"}>{day.counted ? t.stock.closedCounted : t.stock.closedNotCounted}</Chip>
    ) : day.status === "open" ? (
      <Chip tone="blue">{t.stock.open}</Chip>
    ) : (
      <Chip tone="gray">{isToday ? t.stock.notStarted : t.stock.noActivity}</Chip>
    );

  async function handleReopen() {
    try {
      await reopen({ date });
      toast.success(t.stock.reopened(fmt.shortDate(date)));
      setModal(null);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            {t.stock.title} {status}
          </span>
        }
        description={fmt.day(date)}
        actions={
          <>
            {editable && (
              <>
                <LinkButton to="/inventory/delivery" variant="secondary" size="lg" data-tour="stock-delivery">
                  <Truck className="size-6" /> {t.stock.deliveryArrived}
                </LinkButton>
                <Button variant="secondary" size="lg" onClick={() => setModal("damage")} data-tour="stock-damaged">
                  <PackageMinus className="size-6" /> {t.stock.damaged}
                </Button>
                <Button variant="secondary" size="lg" onClick={() => setAdjustFor("any")}>
                  <SlidersHorizontal className="size-6" /> {t.stock.adjust}
                </Button>
                <LinkButton to={`/inventory/close?date=${date}`} size="lg" data-tour="stock-close">
                  <ClipboardCheck className="size-6" /> {t.stock.countClose}
                </LinkButton>
              </>
            )}
            {closed && day.isLatest && (
              <Button variant="secondary" size="lg" onClick={() => setModal("reopen")} data-tour="stock-reopen">
                <RotateCcw className="size-6" /> {t.stock.reopen}
              </Button>
            )}
            <Button variant="secondary" size="lg" onClick={() => setModal("print")} aria-label={t.stock.printReport}>
              <Printer className="size-6" /> <span className="hidden xl:inline">{t.stock.printReport}</span>
            </Button>
          </>
        }
      />

      <div className="mb-5" data-tour="stock-date">
        <DateNav date={date} today={today} onChange={setDate} />
      </div>

      <div className="space-y-3">
        {day.previousOpen && (
          <Alert
            tone="amber"
            icon={ClipboardCheck}
            title={t.stock.notClosedTitle(fmt.shortDate(day.previousOpen))}
            action={
              <LinkButton to={`/inventory/close?date=${day.previousOpen}`} variant="secondary">
                {t.stock.countCloseDate(fmt.shortDate(day.previousOpen))}
              </LinkButton>
            }
          >
            {t.stock.notClosedHint(fmt.shortDate(day.previousOpen))}
          </Alert>
        )}
        {isToday && day.status === "not_started" && !day.previousOpen && (
          <Alert tone="blue" icon={Info} title={t.stock.notStartedTitle}>
            {t.stock.notStartedHint}
          </Alert>
        )}
        {closed && isToday && (
          <Alert tone="green" icon={CheckCircle2} title={t.stock.closedTitle}>
            {t.stock.closedHint}
          </Alert>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 xl:grid-cols-4" data-tour="stock-totals">
        <StatCard title={t.stock.start} icon={Boxes} tone="gray" value={totals.starting} caption={t.stock.casesUnit} />
        <StatCard title={t.stock.received} icon={PackagePlus} tone="green" value={`+${totals.stockIn}`} caption={t.stock.casesUnit} />
        <StatCard
          title={t.stock.sold}
          icon={ShoppingCart}
          tone="blue"
          value={`−${totals.sold}`}
          caption={`${t.common.orders(activeOrders.length)} · ${fmt.money(sales)}`}
        />
        <StatCard title={closed ? t.stock.end : t.stock.now} icon={Boxes} tone="violet" value={totals.end} caption={t.stock.casesUnit} />
      </div>

      <Card className="mt-5" data-tour="stock-table">
        <CardHeader
          title={closed ? t.stock.end : t.stock.now}
          action={
            <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
              {showAll ? t.stock.hideAll : t.stock.showAll}
            </Button>
          }
        />
        {day.rows.length === 0 ? (
          <EmptyState title={t.stock.noProducts} action={<LinkButton to="/products">{t.stock.addProducts}</LinkButton>} />
        ) : showAll ? (
          <div className="overflow-x-auto px-2 pb-3">
            <table className="w-full min-w-[46rem] text-base">
              <thead>
                <tr className="border-b border-line text-sm tracking-wide text-ink-3 uppercase">
                  <th className="px-3 py-3 text-left font-semibold">{t.reports.colProduct}</th>
                  <th className="px-2 py-3 text-right font-semibold">{t.stock.startShort}</th>
                  <th className="px-2 py-3 text-right font-semibold">{t.stock.inShort}</th>
                  <th className="px-2 py-3 text-right font-semibold">{t.stock.soldShort}</th>
                  <th className="px-2 py-3 text-right font-semibold">{t.stock.returnedShort}</th>
                  <th className="px-2 py-3 text-right font-semibold">{t.stock.damagedShort}</th>
                  <th className="px-2 py-3 text-right font-semibold">{t.stock.correctedShort}</th>
                  <th className="px-2 py-3 text-right font-semibold">{closed ? t.stock.systemShort : t.stock.nowShort}</th>
                  {closed && <th className="px-2 py-3 text-right font-semibold">{t.stock.countedShort}</th>}
                  {closed && <th className="px-3 py-3 text-right font-semibold">{t.stock.differenceShort}</th>}
                  {editable && (
                    <th className="px-3 py-3">
                      <span className="sr-only">{t.stock.adjust}</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-line tabular">
                {day.rows.map((row) => (
                  <tr key={row.productId}>
                    <td className="px-3 py-3 font-semibold text-ink">{row.name}</td>
                    <td className="px-2 py-3 text-right">{row.starting}</td>
                    <td className="px-2 py-3 text-right">{row.stockIn ? `+${row.stockIn}` : "–"}</td>
                    <td className="px-2 py-3 text-right">{row.sold ? `−${row.sold}` : "–"}</td>
                    <td className="px-2 py-3 text-right">{row.returned ? `+${row.returned}` : "–"}</td>
                    <td className="px-2 py-3 text-right">{row.damaged ? `−${row.damaged}` : "–"}</td>
                    <td className="px-2 py-3 text-right">{row.adjusted ? `${row.adjusted > 0 ? "+" : "−"}${Math.abs(row.adjusted)}` : "–"}</td>
                    <td className="px-2 py-3 text-right font-bold">{row.expected}</td>
                    {closed && <td className="px-2 py-3 text-right font-bold">{row.counted ?? "–"}</td>}
                    {closed && (
                      <td
                        className={cx(
                          "px-3 py-3 text-right font-bold",
                          row.variance !== undefined && row.variance < 0 && "text-[#B42318]",
                          row.variance !== undefined && row.variance > 0 && "text-[#93370D]",
                        )}
                      >
                        {row.variance === undefined ? "–" : row.variance === 0 ? "0" : `${row.variance > 0 ? "+" : "−"}${Math.abs(row.variance)}`}
                      </td>
                    )}
                    {editable && (
                      <td className="px-3 py-2 text-right">
                        <AdjustButton name={row.name} onClick={() => setAdjustFor(row.productId)} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ul className="divide-y divide-line px-2 pb-2">
            {day.rows.map((row) => {
              const low = row.active && row.lowStockLevel > 0 && row.expected <= row.lowStockLevel;
              const end = row.counted ?? row.expected;
              return (
                <li key={row.productId} className="flex flex-wrap items-center gap-3 rounded-xl px-3 py-3">
                  <ProductTile category={row.category} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold text-ink">{row.name}</p>
                    <p className="truncate text-base text-ink-3">
                      {closed && row.counted !== undefined
                        ? t.stock.countedLine(row.counted, row.variance ?? 0)
                        : t.stock.lineDetail(row.starting, row.stockIn, row.sold)}
                    </p>
                  </div>
                  {low && !closed && <Chip tone="amber">{t.stock.low}</Chip>}
                  <div className="text-right">
                    <p className={cx("text-2xl font-bold tabular", low && !closed ? "text-[#93370D]" : "text-ink")}>{end}</p>
                    <p className="text-sm text-ink-3">{t.stock.casesUnit}</p>
                  </div>
                  {/* On phones the button takes its own line so the product name has room. */}
                  {editable && <AdjustButton name={row.name} onClick={() => setAdjustFor(row.productId)} className="max-sm:w-full" />}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card data-tour="stock-empties">
          <CardHeader
            title={t.stock.emptiesTitle}
            description={t.stock.emptiesHint}
            action={
              <Button variant="secondary" size="sm" onClick={() => setModal("empties")}>
                {t.stock.correct}
              </Button>
            }
          />
          <ul className="divide-y divide-line px-5 pb-2 sm:px-6">
            {products
              .filter((p) => p.returnable && p.active)
              .map((product) => (
                <li key={product._id} className="flex justify-between gap-3 py-2.5 text-base">
                  <span className="text-ink-2">{product.name}</span>
                  <span className="font-bold tabular">{product.emptiesOnHand}</span>
                </li>
              ))}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title={t.stock.pastDays}
            description={t.stock.pastDaysHint}
          />
          {!recent || recent.length === 0 ? (
            <p className="px-6 pb-6 text-base text-ink-3">{t.stock.noActivityYet}</p>
          ) : (
            <ul className="max-h-[28rem] divide-y divide-line overflow-y-auto px-2 pb-2">
              {recent.map((row) => (
                <li key={row.date}>
                  <button
                    type="button"
                    onClick={() => navigate(row.date === today ? "/inventory" : `/inventory?date=${row.date}`)}
                    className={cx(
                      "flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-3 text-left hover:bg-gray-50",
                      row.date === date && "bg-brand-soft",
                    )}
                  >
                    <span className="w-24 text-base font-semibold text-ink">{fmt.shortDate(row.date)}</span>
                    {row.status === "open" ? (
                      <Chip tone="blue">{t.stock.open}</Chip>
                    ) : row.counted ? (
                      <Chip tone="green">{t.stock.counted}</Chip>
                    ) : (
                      <Chip tone="amber">{t.stock.notCounted}</Chip>
                    )}
                    <span className="ml-auto text-base text-ink-2 tabular">
                      {t.stock.soldShort} {row.sold} · {fmt.money(row.sales)}
                    </span>
                    {row.variance !== 0 && (
                      <Chip tone={row.variance < 0 ? "red" : "amber"}>
                        {row.variance > 0 ? "+" : "−"}
                        {Math.abs(row.variance)}
                      </Chip>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-5">
        <Button variant="ghost" onClick={() => setShowActivity((v) => !v)}>
          {showActivity ? t.stock.hideActivity : t.stock.showActivity}
        </Button>
        {showActivity && <Activity date={date} />}
      </div>

      {modal === "damage" && <DamageModal products={products.filter((p) => p.active)} rows={day.rows} onClose={() => setModal(null)} />}
      {adjustFor && (
        <AdjustStockModal
          rows={day.rows}
          productId={adjustFor === "any" ? undefined : adjustFor}
          onClose={() => setAdjustFor(null)}
        />
      )}
      {modal === "empties" && <WarehouseEmptiesModal products={products.filter((p) => p.returnable && p.active)} onClose={() => setModal(null)} />}
      <PrintPreview
        open={modal === "print"}
        onClose={() => setModal(null)}
        title={t.stock.reportTitle(fmt.shortDate(date))}
        render={(settings) => <DayReportSlip settings={settings} day={day} sales={sales} collected={collected} orders={activeOrders.length} />}
      />
      <Modal
        open={modal === "reopen"}
        onClose={() => setModal(null)}
        title={t.stock.reopenTitle(fmt.shortDate(date))}
        footer={
          <>
            <Button variant="secondary" size="lg" onClick={() => setModal(null)}>
              {t.common.cancel}
            </Button>
            <Button size="lg" onClick={handleReopen}>
              {t.stock.reopenConfirm}
            </Button>
          </>
        }
      >
        <p className="text-base text-ink-2">{t.stock.reopenBody}</p>
      </Modal>
    </>
  );
}

function Activity({ date }: { date: string }) {
  const t = useT();
  const fmt = useFmt();
  const activity = useQuery(api.inventory.activity, { date });
  if (!activity) return null;
  if (activity.stock.length === 0 && activity.empties.length === 0) {
    return <p className="px-4 py-4 text-base text-ink-3">{t.stock.noActivityYet}</p>;
  }
  return (
    <Card className="mt-3">
      <CardHeader title={t.stock.activityTitle} />
      <ul className="divide-y divide-line px-5 pb-2 text-base sm:px-6">
        {activity.stockIns.map((stockIn) => (
          <li key={stockIn._id} className="py-3">
            <p className="flex items-center gap-2 font-semibold text-ink">
              <Truck className="size-5 text-ink-3" /> {t.stock.deliveryFrom(stockIn.supplier)}
              <span className="font-normal text-ink-3">· {fmt.time(stockIn._creationTime)}</span>
            </p>
            <p className="text-ink-2">
              {stockIn.items.map((i) => `${i.quantity} ${i.name}`).join(", ")}
              {stockIn.totalCost > 0 && ` · ${fmt.money(stockIn.totalCost)}`}
            </p>
            {stockIn.emptiesReturned.length > 0 && (
              <p className="text-ink-3">{t.stock.emptiesGivenBack(stockIn.emptiesReturned.map((i) => `${i.quantity} ${i.name}`).join(", "))}</p>
            )}
          </li>
        ))}
        {activity.stock
          .filter((m) => m.type !== "stock_in")
          .map((move) => (
            <li key={move._id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0 text-ink-2">
                {t.stock.movement[move.type]} · {move.productName}
                {move.note && <span className="text-ink-3"> · {move.note}</span>}
              </span>
              <span className={cx("font-bold tabular", move.quantity > 0 && "text-[#146C43]")}>
                {move.quantity > 0 ? "+" : "−"}
                {Math.abs(move.quantity)}
              </span>
            </li>
          ))}
      </ul>
    </Card>
  );
}

function AdjustButton({ name, onClick, className }: { name: string; onClick: () => void; className?: string }) {
  const t = useT();
  return (
    <Button variant="secondary" size="sm" onClick={onClick} aria-label={`${t.stock.adjust}: ${name}`} className={className}>
      <SlidersHorizontal className="size-4" /> {t.stock.adjustRow}
    </Button>
  );
}

// A correction to the stock: type the real count, or add or remove cases.
// Saved as an adjustment, shown in the Corrected column.
function AdjustStockModal({
  rows,
  productId: initialProductId,
  onClose,
}: {
  rows: { productId: Id<"products">; name: string; expected: number }[];
  productId?: Id<"products">;
  onClose: () => void;
}) {
  const t = useT();
  const errorMessage = useErrorMessage();
  const adjustStock = useMutation(api.inventory.adjustStock);
  const stockOf = (id: string) => rows.find((r) => r.productId === id)?.expected ?? 0;
  const [productId, setProductId] = useState<string>(initialProductId ?? rows[0]?.productId ?? "");
  const [kind, setKind] = useState<"count" | "add" | "remove">("count");
  const [count, setCount] = useState(() => stockOf(productId));
  const [quantity, setQuantity] = useState(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const inStock = stockOf(productId);
  const delta = kind === "count" ? count - inStock : kind === "add" ? quantity : -quantity;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (delta === 0) return toast.error(t.adjustStock.noChange);
    if (!note.trim()) return toast.error(t.damage.needReason);
    setSaving(true);
    try {
      await adjustStock({ productId: productId as Id<"products">, delta, note });
      toast.success(t.damage.saved);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t.stock.adjust}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label={t.damage.product} hint={t.damage.inStockNow(inStock)}>
          <Select
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              setCount(stockOf(e.target.value));
            }}
          >
            {rows.map((r) => (
              <option key={r.productId} value={r.productId}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
        <ChoiceCards
          label={t.stock.adjust}
          value={kind}
          onChange={setKind}
          columns={3}
          options={[
            { value: "count", label: t.adjustStock.realCount },
            { value: "add", label: t.adjustStock.add },
            { value: "remove", label: t.adjustStock.remove },
          ]}
        />
        {kind === "count" ? (
          <Field label={t.adjustStock.countLabel} hint={t.adjustStock.difference(delta)}>
            <Stepper value={count} onChange={setCount} label={t.adjustStock.countLabel} />
          </Field>
        ) : (
          <Field label={t.damage.cases}>
            <Stepper value={quantity} onChange={setQuantity} max={kind === "add" ? undefined : inStock} label={t.damage.cases} />
          </Field>
        )}
        <Field label={t.common.reason} hint={t.damage.reasonHintOther}>
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

function DamageModal({
  products,
  rows,
  onClose,
}: {
  products: Doc<"products">[];
  rows: { productId: Id<"products">; expected: number }[];
  onClose: () => void;
}) {
  const t = useT();
  const errorMessage = useErrorMessage();
  const recordDamage = useMutation(api.inventory.recordDamage);
  const adjustStock = useMutation(api.inventory.adjustStock);
  const [kind, setKind] = useState<"damage" | "add" | "remove">("damage");
  const [productId, setProductId] = useState<string>(products[0]?._id ?? "");
  const [quantity, setQuantity] = useState(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const inStock = rows.find((r) => r.productId === productId)?.expected ?? 0;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (quantity <= 0) return toast.error(t.clients.enterCases);
    if (kind !== "damage" && !note.trim()) return toast.error(t.damage.needReason);
    setSaving(true);
    try {
      const id = productId as Id<"products">;
      if (kind === "damage") await recordDamage({ productId: id, quantity, note });
      else await adjustStock({ productId: id, delta: kind === "add" ? quantity : -quantity, note });
      toast.success(t.damage.saved);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t.damage.title}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <ChoiceCards
          label={t.damage.title}
          value={kind}
          onChange={setKind}
          columns={3}
          options={[
            { value: "damage", label: t.damage.damaged },
            { value: "add", label: t.damage.extra },
            { value: "remove", label: t.damage.missing },
          ]}
        />
        <Field label={t.damage.product} hint={t.damage.inStockNow(inStock)}>
          <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
            {products.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t.damage.cases}>
          <Stepper value={quantity} onChange={setQuantity} max={kind === "add" ? undefined : inStock} label={t.damage.cases} />
        </Field>
        <Field label={t.common.reason} hint={kind === "damage" ? t.damage.reasonHintDamaged : t.damage.reasonHintOther}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" size="lg" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit" size="lg" loading={saving} variant={kind === "add" ? "primary" : "danger"}>
            {t.common.save}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function WarehouseEmptiesModal({ products, onClose }: { products: Doc<"products">[]; onClose: () => void }) {
  const t = useT();
  const errorMessage = useErrorMessage();
  const adjust = useMutation(api.inventory.adjustWarehouseEmpties);
  const [productId, setProductId] = useState<string>(products[0]?._id ?? "");
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [quantity, setQuantity] = useState(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const product = products.find((p) => p._id === productId);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (quantity <= 0) return toast.error(t.clients.enterCases);
    if (!note.trim()) return toast.error(t.damage.needReason);
    setSaving(true);
    try {
      await adjust({ productId: productId as Id<"products">, delta: direction === "add" ? quantity : -quantity, note });
      toast.success(t.warehouseEmpties.saved);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t.warehouseEmpties.title}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label={t.damage.product} hint={product ? t.warehouseEmpties.onHand(product.emptiesOnHand) : undefined}>
          <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
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
            { value: "add", label: t.warehouseEmpties.add },
            { value: "remove", label: t.warehouseEmpties.remove },
          ]}
        />
        <Field label={t.damage.cases}>
          <Stepper value={quantity} onChange={setQuantity} label={t.damage.cases} />
        </Field>
        <Field label={t.common.reason} hint={t.warehouseEmpties.reasonHint}>
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
