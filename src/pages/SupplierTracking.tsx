import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Landmark, PackagePlus, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { computePurchase, type SupplierKey } from "../../convex/lib/suppliers";
import { DateNav } from "../components/DateNav";
import { ProductTile } from "../components/ProductTile";
import { Button, Card, CardHeader, Chip, Field, Input, Modal, PageHeader, PageLoading, PesoInput, Spinner, Stepper } from "../components/ui";
import { useErrorMessage, useFmt, useT } from "../i18n";
import { cx, parsePeso, pesoInput } from "../lib/format";
import { useToday } from "../lib/useToday";

type Overview = NonNullable<ReturnType<typeof useOverview>>;
type CheckRow = Overview["checks"][number];
type Saved = { purchaseId: Id<"supplierPurchases">; cases: number; empties: number };

function useOverview(supplier: SupplierKey) {
  return useQuery(api.suppliers.overview, { supplier, today: useToday() });
}

// The Coke and San Miguel tabs: purchases (full goods − empties = total), an
// "add to stock?" prompt, and (San Miguel) the checks given.
export default function SupplierTracking({ supplier }: { supplier: SupplierKey }) {
  const t = useT();
  const fmt = useFmt();
  const errorMessage = useErrorMessage();
  const data = useOverview(supplier);
  const addToStock = useMutation(api.suppliers.addPurchaseToStock);
  const [buying, setBuying] = useState(false);
  const [addingCheck, setAddingCheck] = useState(false);
  const [stockPrompt, setStockPrompt] = useState<Saved | null>(null);

  if (!data) return <PageLoading />;
  const name = t.suppliers.names[supplier];

  async function handleAddToStock(purchaseId: Id<"supplierPurchases">) {
    try {
      await addToStock({ purchaseId });
      toast.success(t.suppliers.addedToStock);
      setStockPrompt(null);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader
        title={t.suppliers.title(name)}
        description={t.suppliers.hint(name)}
        actions={
          <Button size="lg" onClick={() => setBuying(true)} disabled={data.products.length === 0}>
            <Plus className="size-6" strokeWidth={2.5} /> {t.suppliers.newPurchase}
          </Button>
        }
      />

      <div className="space-y-5">
        <SalesCard supplier={supplier} />
        {supplier === "sanMiguel" && <ChecksCard checks={data.checks} onAdd={() => setAddingCheck(true)} />}
        <Card>
          <CardHeader title={t.suppliers.purchasesTitle} />
          {data.products.length === 0 ? (
            <p className="px-6 pb-6 text-base text-ink-3">{t.suppliers.noProducts(name)}</p>
          ) : data.purchases.length === 0 ? (
            <p className="px-6 pb-6 text-base text-ink-3">{t.suppliers.noPurchases}</p>
          ) : (
            <ul className="divide-y divide-line px-5 pb-2 sm:px-6">
              {data.purchases.map((purchase) => (
                <li key={purchase._id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-semibold text-ink">
                      {fmt.shortDate(purchase.date)}
                      {purchase.reference && <span className="font-normal text-ink-3"> · {purchase.reference}</span>}
                    </p>
                    <p className="text-base text-ink-3">
                      {t.suppliers.fullGoods(purchase.cases)} {fmt.money(purchase.fullGoods)}
                      {purchase.empties > 0 && ` · ${t.suppliers.lessEmpties(purchase.empties)} −${fmt.money(purchase.emptiesAmount)}`}
                    </p>
                  </div>
                  <span className="text-xl font-bold tabular">{fmt.money(purchase.total)}</span>
                  {purchase.stockInId ? (
                    <Chip tone="green">{t.suppliers.inStock}</Chip>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => handleAddToStock(purchase._id)}>
                      <PackagePlus className="size-4" /> {t.suppliers.addToStock}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {buying && (
        <PurchaseModal
          supplier={supplier}
          products={data.products}
          onClose={() => setBuying(false)}
          onSaved={(saved) => {
            setBuying(false);
            setStockPrompt(saved);
          }}
        />
      )}
      {addingCheck && <CheckModal supplier={supplier} onClose={() => setAddingCheck(false)} />}
      <Modal
        open={stockPrompt !== null}
        onClose={() => setStockPrompt(null)}
        title={t.suppliers.addToStockTitle}
        description={stockPrompt ? t.suppliers.addToStockHint(stockPrompt.cases, stockPrompt.empties) : undefined}
        footer={
          <>
            <Button variant="secondary" size="lg" onClick={() => setStockPrompt(null)}>
              {t.suppliers.notNow}
            </Button>
            <Button size="lg" onClick={() => stockPrompt && handleAddToStock(stockPrompt.purchaseId)}>
              <PackagePlus className="size-6" /> {t.suppliers.addToStockYes}
            </Button>
          </>
        }
      >
        {null}
      </Modal>
    </>
  );
}

// How much of this supplier's products were sold on a day, per product.
function SalesCard({ supplier }: { supplier: SupplierKey }) {
  const t = useT();
  const fmt = useFmt();
  const today = useToday();
  const [date, setDate] = useState(today);
  const sales = useQuery(api.suppliers.salesByDay, { supplier, date });
  const name = t.suppliers.names[supplier];
  return (
    <Card>
      <CardHeader title={t.suppliers.salesTitle(name)} description={t.suppliers.salesHint} />
      <div className="px-5 pb-4 sm:px-6">
        <DateNav date={date} today={today} onChange={setDate} />
      </div>
      {sales === undefined ? (
        <div className="px-6 pb-6">
          <Spinner />
        </div>
      ) : !sales || sales.rows.length === 0 ? (
        <p className="px-6 pb-6 text-base text-ink-3">{t.suppliers.noSales(name)}</p>
      ) : (
        <>
          <ul className="divide-y divide-line px-5 sm:px-6">
            {sales.rows.map((row) => (
              <li key={row.productId} className="flex items-center gap-3 py-3">
                <ProductTile category={row.category} size="sm" />
                <p className="min-w-0 flex-1 truncate text-lg font-semibold text-ink">{row.name}</p>
                <span className="text-lg font-bold tabular">{t.common.cases(row.cases)}</span>
                <span className="w-28 text-right text-lg text-ink-2 tabular">{fmt.money(row.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-line bg-brand-soft px-5 py-4 sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="text-xl font-bold text-ink">{t.suppliers.salesTotal}</p>
              <p className="text-base text-ink-3">{t.suppliers.salesOrders(sales.orders)}</p>
            </div>
            <span className="text-xl font-bold tabular">{t.common.cases(sales.cases)}</span>
            <span className="w-28 text-right text-xl font-bold tabular">{fmt.money(sales.amount)}</span>
          </div>
        </>
      )}
    </Card>
  );
}

type Line = { quantity: number; cost: string; emptiesReturned: number; emptyValue: string };

function PurchaseModal({
  supplier,
  products,
  onClose,
  onSaved,
}: {
  supplier: SupplierKey;
  products: Overview["products"];
  onClose: () => void;
  onSaved: (saved: Saved) => void;
}) {
  const t = useT();
  const fmt = useFmt();
  const errorMessage = useErrorMessage();
  const createPurchase = useMutation(api.suppliers.createPurchase);
  // Prices start from the Products page and can be changed for this purchase.
  const [lines, setLines] = useState<Record<string, Line>>(() =>
    Object.fromEntries(
      products.map((p) => [p._id, { quantity: 0, cost: pesoInput(p.cost), emptiesReturned: 0, emptyValue: pesoInput(p.emptyValue) }]),
    ),
  );
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const update = (id: string, patch: Partial<Line>) => setLines((l) => ({ ...l, [id]: { ...l[id], ...patch } }));

  const chosen = products
    .map((product) => ({ product, line: lines[product._id] }))
    .filter(({ line }) => line.quantity > 0 || line.emptiesReturned > 0);
  const items = chosen.map(({ product, line }) => ({
    productId: product._id,
    quantity: line.quantity,
    cost: parsePeso(line.cost),
    emptiesReturned: line.emptiesReturned,
    emptyValue: line.emptiesReturned > 0 ? parsePeso(line.emptyValue) : 0,
  }));
  const bad = chosen.find((_, i) => items[i].cost === null || items[i].emptyValue === null);
  const totals = bad ? null : computePurchase(items as { quantity: number; cost: number; emptiesReturned: number; emptyValue: number }[]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (items.length === 0) return toast.error(t.suppliers.enterCases);
    if (bad) return toast.error(t.suppliers.checkCost(bad.product.name));
    setSaving(true);
    try {
      const saved = await createPurchase({
        supplier,
        reference,
        items: items as { productId: Id<"products">; quantity: number; cost: number; emptiesReturned: number; emptyValue: number }[],
      });
      toast.success(t.suppliers.purchaseSaved);
      onSaved(saved);
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t.suppliers.purchaseTitle(t.suppliers.names[supplier])} description={t.suppliers.hint(t.suppliers.names[supplier])} wide>
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label={t.suppliers.reference} hint={t.common.optional}>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <ul className="divide-y divide-line rounded-2xl border border-line px-4">
          {products.map((product) => {
            const line = lines[product._id];
            return (
              <li key={product._id} className="space-y-3 py-4">
                <p className="flex items-center gap-3 text-lg font-semibold text-ink">
                  <ProductTile category={product.category} /> {product.name}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t.suppliers.fullCases}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Stepper value={line.quantity} onChange={(quantity) => update(product._id, { quantity })} label={`${t.suppliers.fullCases}: ${product.name}`} />
                      <span className="text-ink-3">×</span>
                      <PesoInput
                        value={line.cost}
                        onChange={(cost) => update(product._id, { cost })}
                        aria-label={`${t.suppliers.costPerCase}: ${product.name}`}
                        className="w-32"
                      />
                    </div>
                  </Field>
                  {product.returnable && (
                    <Field label={t.suppliers.emptiesReturned}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Stepper
                          value={line.emptiesReturned}
                          onChange={(emptiesReturned) => update(product._id, { emptiesReturned })}
                          label={`${t.suppliers.emptiesReturned}: ${product.name}`}
                        />
                        <span className="text-ink-3">×</span>
                        <PesoInput
                          value={line.emptyValue}
                          onChange={(emptyValue) => update(product._id, { emptyValue })}
                          aria-label={`${t.suppliers.emptyValue}: ${product.name}`}
                          className="w-32"
                        />
                      </div>
                    </Field>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <dl className="space-y-1.5 rounded-2xl bg-canvas p-4 text-base">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-2">{t.suppliers.fullGoods(totals?.cases ?? 0)}</dt>
            <dd className="font-semibold tabular">{totals ? fmt.money(totals.fullGoods) : "–"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-2">{t.suppliers.lessEmpties(totals?.empties ?? 0)}</dt>
            <dd className="font-semibold tabular">{totals ? `−${fmt.money(totals.emptiesAmount)}` : "–"}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-line pt-2 text-lg">
            <dt className="font-bold text-ink">{t.suppliers.total}</dt>
            <dd className={cx("font-bold tabular", totals && totals.total < 0 && "text-[#B42318]")}>{totals ? fmt.money(totals.total) : "–"}</dd>
          </div>
        </dl>
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

function ChecksCard({ checks, onAdd }: { checks: CheckRow[]; onAdd: () => void }) {
  const t = useT();
  const fmt = useFmt();
  const errorMessage = useErrorMessage();
  const setStatus = useMutation(api.suppliers.setCheckStatus);

  async function change(checkId: Id<"supplierChecks">, status: Doc<"supplierChecks">["status"]) {
    try {
      await setStatus({ checkId, status });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <Card>
      <CardHeader
        title={t.suppliers.checksTitle}
        description={t.suppliers.checksHint}
        action={
          <Button variant="secondary" size="sm" onClick={onAdd}>
            <Landmark className="size-4" /> {t.suppliers.addCheck}
          </Button>
        }
      />
      {checks.length === 0 ? (
        <p className="px-6 pb-6 text-base text-ink-3">{t.suppliers.noChecks}</p>
      ) : (
        <ul className="divide-y divide-line p-2">
          {checks.map((check) => (
            <li
              key={check._id}
              className={cx("flex flex-wrap items-center gap-3 rounded-xl px-3 py-3", check.warning && "bg-[#FEF3F2]")}
            >
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold text-ink">
                  #{check.checkNo}
                  {check.bank && <span className="font-normal text-ink-3"> · {check.bank}</span>}
                </p>
                <p className="text-base text-ink-3">
                  {t.suppliers.dated(fmt.shortDate(check.checkDate))} · {t.suppliers.due(fmt.shortDate(check.dueDate))}
                </p>
                <p className="mt-1 flex flex-wrap gap-1.5">
                  <Chip tone={check.status === "cleared" ? "green" : check.status === "bounced" ? "red" : "gray"}>
                    {t.suppliers.statuses[check.status]}
                  </Chip>
                  {check.warning && <CheckWarningChip warning={check.warning} />}
                </p>
              </div>
              <span className="text-xl font-bold tabular">{fmt.money(check.amount)}</span>
              <span className="flex gap-2">
                {check.status === "pending" ? (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => change(check._id, "cleared")}>
                      {t.suppliers.markCleared}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => change(check._id, "bounced")}>
                      {t.suppliers.markBounced}
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => change(check._id, "pending")}>
                    {t.suppliers.markPending}
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function CheckWarningChip({ warning }: { warning: NonNullable<CheckRow["warning"]> }) {
  const t = useT();
  const text =
    warning.kind === "afterDue"
      ? t.suppliers.warnAfterDue
      : warning.kind === "overdue"
        ? t.suppliers.warnOverdue(warning.days)
        : t.suppliers.warnDueSoon(warning.days);
  return (
    <Chip tone={warning.kind === "dueSoon" ? "amber" : "red"} solid={warning.kind !== "dueSoon"} icon={AlertTriangle}>
      {text}
    </Chip>
  );
}

function CheckModal({ supplier, onClose }: { supplier: SupplierKey; onClose: () => void }) {
  const t = useT();
  const errorMessage = useErrorMessage();
  const addCheck = useMutation(api.suppliers.addCheck);
  const [checkNo, setCheckNo] = useState("");
  const [bank, setBank] = useState("");
  const [amount, setAmount] = useState("");
  const [checkDate, setCheckDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const value = parsePeso(amount);
    if (!checkNo.trim() || !value || !checkDate || !dueDate) return toast.error(t.suppliers.needCheck);
    setSaving(true);
    try {
      await addCheck({ supplier, checkNo, bank, amount: value, checkDate, dueDate });
      toast.success(t.suppliers.checkSaved);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t.suppliers.addCheck} description={t.suppliers.checksHint}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t.suppliers.checkNo}>
            <Input value={checkNo} onChange={(e) => setCheckNo(e.target.value)} autoFocus />
          </Field>
          <Field label={t.suppliers.bank} hint={t.common.optional}>
            <Input value={bank} onChange={(e) => setBank(e.target.value)} />
          </Field>
        </div>
        <Field label={t.suppliers.amount}>
          <PesoInput value={amount} onChange={setAmount} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t.suppliers.checkDate}>
            <Input type="date" value={checkDate} onChange={(e) => setCheckDate(e.target.value)} />
          </Field>
          <Field label={t.suppliers.dueDate}>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        </div>
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
