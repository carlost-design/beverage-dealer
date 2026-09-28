import { useMutation, useQuery } from "convex/react";
import { Package, Pencil, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { ProductTile } from "../components/ProductTile";
import { Button, Card, Chip, EmptyState, Field, Input, Modal, PageHeader, PageLoading, PesoInput, Segmented, Stepper } from "../components/ui";
import { useErrorMessage, useFmt, useT } from "../i18n";
import { cx, parsePeso, pesoInput } from "../lib/format";
import { useToday } from "../lib/useToday";

type Category = "softdrinks" | "beer" | "other";

export default function Products() {
  const t = useT();
  const fmt = useFmt();
  const errorMessage = useErrorMessage();
  const today = useToday();
  const products = useQuery(api.products.list);
  const stock = useQuery(api.inventory.day, { date: today });
  const setActive = useMutation(api.products.setActive);
  const [editing, setEditing] = useState<Doc<"products"> | "new" | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  if (!products) return <PageLoading />;
  const stockOf = new Map((stock?.rows ?? []).map((row) => [row.productId, row.expected]));
  const visible = products.filter((p) => p.active !== showArchived);
  const archivedCount = products.filter((p) => !p.active).length;

  async function toggle(product: Doc<"products">) {
    try {
      await setActive({ productId: product._id, active: !product.active });
      toast.success(product.active ? t.products.archivedToast(product.name) : t.products.restoredToast(product.name));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader
        title={t.products.title}
        description={t.products.hint}
        actions={
          <Button size="lg" onClick={() => setEditing("new")}>
            <Plus className="size-6" strokeWidth={2.5} /> {t.products.add}
          </Button>
        }
      />
      {archivedCount > 0 && (
        <div className="mb-4">
          <Segmented
            value={showArchived ? "archived" : "active"}
            onChange={(v) => setShowArchived(v === "archived")}
            options={[
              { value: "active", label: t.products.active },
              { value: "archived", label: t.products.archived(archivedCount) },
            ]}
          />
        </div>
      )}
      <Card>
        {visible.length === 0 ? (
          <EmptyState
            icon={Package}
            title={showArchived ? t.products.emptyArchived : t.products.emptyTitle}
            action={
              !showArchived && (
                <Button onClick={() => setEditing("new")}>
                  <Plus className="size-5" /> {t.products.addFirst}
                </Button>
              )
            }
          >
            {!showArchived && t.products.emptyHint}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line p-2">
            {visible.map((product) => {
              const inStock = stockOf.get(product._id) ?? 0;
              const low = product.lowStockLevel > 0 && inStock <= product.lowStockLevel;
              return (
                <li key={product._id} className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl px-3 py-3.5">
                  <ProductTile category={product.category} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-bold text-ink">{product.name}</p>
                    <p className="mt-1 flex flex-wrap gap-1.5">
                      <Chip tone="gray">{fmt.category(product.category)}</Chip>
                      {product.returnable && <Chip tone="blue">{t.products.returnable}</Chip>}
                    </p>
                  </div>
                  <dl className="grid grid-cols-3 gap-x-6 gap-y-1 text-right sm:grid-cols-4">
                    <Metric label={t.products.price} value={fmt.money(product.price)} strong />
                    <Metric label={t.products.cost} value={fmt.money(product.cost)} />
                    <Metric
                      label={t.products.profit}
                      value={fmt.money(product.price - product.cost)}
                      className={product.price < product.cost ? "text-[#B42318]" : "text-[#146C43]"}
                    />
                    <Metric
                      label={t.products.inStock}
                      value={String(inStock)}
                      className={cx("hidden sm:block", low && "text-[#93370D]")}
                      hint={product.lowStockLevel > 0 ? t.products.lowLevel(product.lowStockLevel) : undefined}
                    />
                  </dl>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setEditing(product)}>
                      <Pencil className="size-4" /> {t.products.edit}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggle(product)}>
                      {product.active ? t.products.archive : t.products.restore}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <p className="mt-4 text-base text-ink-3">{t.products.footnote}</p>
      {editing && <ProductModal product={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function Metric({
  label,
  value,
  strong,
  className,
  hint,
}: {
  label: string;
  value: string;
  strong?: boolean;
  className?: string;
  hint?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-sm text-ink-3">{label}</dt>
      <dd className={cx("text-base tabular", strong ? "font-bold text-ink" : "font-semibold")}>{value}</dd>
      {hint && <dd className="text-xs text-ink-3">{hint}</dd>}
    </div>
  );
}

function ProductModal({ product, onClose }: { product?: Doc<"products">; onClose: () => void }) {
  const t = useT();
  const fmt = useFmt();
  const errorMessage = useErrorMessage();
  const create = useMutation(api.products.create);
  const update = useMutation(api.products.update);
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState<Category>(product?.category ?? "softdrinks");
  const [price, setPrice] = useState(pesoInput(product?.price));
  const [cost, setCost] = useState(pesoInput(product?.cost));
  const [returnable, setReturnable] = useState(product?.returnable ?? true);
  const [lowStockLevel, setLowStockLevel] = useState(product?.lowStockLevel ?? 10);
  const [openingStock, setOpeningStock] = useState(0);
  const [openingEmpties, setOpeningEmpties] = useState(0);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const priceValue = parsePeso(price);
    const costValue = parsePeso(cost);
    if (priceValue === null) return toast.error(t.products.needPrice);
    if (costValue === null) return toast.error(t.products.needCost);
    const fields = { name, category, price: priceValue, cost: costValue, returnable, lowStockLevel };
    setSaving(true);
    try {
      if (product) {
        await update({ productId: product._id, product: fields });
        toast.success(t.products.updated(name.trim()));
      } else {
        await create({ product: fields, openingStock, openingEmpties: returnable ? openingEmpties : 0 });
        toast.success(t.products.added(name.trim()));
      }
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={product ? t.products.formEdit(product.name) : t.products.formAdd}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label={t.products.name} hint={t.products.nameHint}>
          <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </Field>
        <Field label={t.products.category}>
          <Segmented
            value={category}
            onChange={setCategory}
            options={(["softdrinks", "beer", "other"] as const).map((c) => ({ value: c, label: fmt.category(c) }))}
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t.products.pricePerCase}>
            <PesoInput value={price} onChange={setPrice} required />
          </Field>
          <Field label={t.products.costPerCase} hint={t.products.costHint}>
            <PesoInput value={cost} onChange={setCost} required />
          </Field>
        </div>
        {product && parsePeso(price) !== product.price && <p className="text-base text-ink-3">{t.products.priceChangeNote}</p>}
        <label className="flex items-start gap-4 rounded-2xl border border-line p-4">
          <input type="checkbox" checked={returnable} onChange={(e) => setReturnable(e.target.checked)} className="mt-1 size-6 rounded accent-brand" />
          <span>
            <span className="block text-base font-semibold text-ink">{t.products.returnableLabel}</span>
            <span className="block text-base text-ink-3">{t.products.returnableHint}</span>
          </span>
        </label>
        <Field label={t.products.lowAlert} hint={t.products.lowAlertHint}>
          <Stepper value={lowStockLevel} onChange={setLowStockLevel} label={t.products.lowAlert} />
        </Field>
        {!product && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t.products.stockNow}>
              <Stepper value={openingStock} onChange={setOpeningStock} label={t.products.stockNow} />
            </Field>
            {returnable && (
              <Field label={t.products.emptiesNow}>
                <Stepper value={openingEmpties} onChange={setOpeningEmpties} label={t.products.emptiesNow} />
              </Field>
            )}
          </div>
        )}
        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" size="lg" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit" size="lg" loading={saving}>
            {product ? t.common.saveChanges : t.products.formAdd}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
