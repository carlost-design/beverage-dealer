import { useMutation, useQuery } from "convex/react";
import { ArrowDown, ArrowUp, Layers, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { supplierOf } from "../../convex/lib/suppliers";
import { ProductTile } from "../components/ProductTile";
import { Button, Card, Chip, EmptyState, Field, Input, Modal, PageHeader, PageLoading, PesoInput, Segmented, Select, Stepper } from "../components/ui";
import { useErrorMessage, useFmt, useT } from "../i18n";
import { cx, parsePeso, pesoInput } from "../lib/format";
import { productSections } from "../lib/productGroups";
import { useToday } from "../lib/useToday";
import { useTourPage } from "../tour/TourProvider";

type Category = "softdrinks" | "beer" | "other";

export default function Products() {
  useTourPage("products");
  const t = useT();
  const fmt = useFmt();
  const errorMessage = useErrorMessage();
  const today = useToday();
  const products = useQuery(api.products.list);
  const groups = useQuery(api.productGroups.list);
  const stock = useQuery(api.inventory.day, { date: today });
  const setActive = useMutation(api.products.setActive);
  const [editing, setEditing] = useState<Doc<"products"> | "new" | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [managingGroups, setManagingGroups] = useState(false);

  if (!products || !groups) return <PageLoading />;
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
          <>
            <Button variant="secondary" size="lg" onClick={() => setManagingGroups(true)}>
              <Layers className="size-6" /> {t.products.groups}
            </Button>
            <Button size="lg" onClick={() => setEditing("new")} data-tour="products-add">
              <Plus className="size-6" strokeWidth={2.5} /> {t.products.add}
            </Button>
          </>
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
      <Card data-tour="products-list">
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
          <div className="divide-y divide-line">
            {productSections(visible, groups, { category: fmt.category, ungrouped: t.products.ungrouped }).map((section) => (
              <section key={section.key}>
                <p className="px-5 pt-4 text-base font-bold tracking-wide text-ink-3 uppercase">{section.title}</p>
                <ul className="divide-y divide-line p-2">
                  {section.products.map((product) => {
                    const inStock = stockOf.get(product._id) ?? 0;
                    const low = product.lowStockLevel > 0 && inStock <= product.lowStockLevel;
                    return (
                      <li key={product._id} className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl px-3 py-3.5">
                        <ProductTile category={product.category} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-lg font-bold text-ink">{product.name}</p>
                          <p className="mt-1 flex flex-wrap gap-1.5">
                            <Chip tone="gray">{fmt.category(product.category)}</Chip>
                            <Chip tone="violet">{t.suppliers.names[supplierOf(product)]}</Chip>
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
              </section>
            ))}
          </div>
        )}
      </Card>
      <p className="mt-4 text-base text-ink-3">{t.products.footnote}</p>
      {editing && <ProductModal product={editing === "new" ? undefined : editing} groups={groups} onClose={() => setEditing(null)} />}
      {managingGroups && <GroupsModal groups={groups} products={products} onClose={() => setManagingGroups(false)} />}
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

function ProductModal({
  product,
  groups,
  onClose,
}: {
  product?: Doc<"products">;
  groups: Doc<"productGroups">[];
  onClose: () => void;
}) {
  const t = useT();
  const fmt = useFmt();
  const errorMessage = useErrorMessage();
  const create = useMutation(api.products.create);
  const update = useMutation(api.products.update);
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState<Category>(product?.category ?? "softdrinks");
  // Unset follows the category until the owner picks one.
  const [supplier, setSupplier] = useState(product?.supplier);
  const shownSupplier = supplier ?? supplierOf({ category });
  const [price, setPrice] = useState(pesoInput(product?.price));
  const [cost, setCost] = useState(pesoInput(product?.cost));
  const [returnable, setReturnable] = useState(product?.returnable ?? true);
  const [lowStockLevel, setLowStockLevel] = useState(product?.lowStockLevel ?? 10);
  const [emptyValue, setEmptyValue] = useState(pesoInput(product?.emptyValue));
  const [groupId, setGroupId] = useState<string>(product?.groupId ?? "");
  const [openingStock, setOpeningStock] = useState(0);
  const [openingEmpties, setOpeningEmpties] = useState(0);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const priceValue = parsePeso(price);
    const costValue = parsePeso(cost);
    if (priceValue === null) return toast.error(t.products.needPrice);
    if (costValue === null) return toast.error(t.products.needCost);
    // Blank means the supplier takes nothing off for empties. Sent as 0, not
    // left out, so clearing a saved value really clears it.
    const emptyValueAmount = returnable && emptyValue.trim() ? parsePeso(emptyValue) : 0;
    if (emptyValueAmount === null) return toast.error(t.products.emptyValueError);
    const fields = { name, category, price: priceValue, cost: costValue, returnable, lowStockLevel, supplier: shownSupplier, emptyValue: emptyValueAmount, groupId: groupId ? (groupId as Id<"productGroups">) : undefined };
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
        {groups.length > 0 && (
          <Field label={t.products.group} hint={t.products.groupHint}>
            <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">{t.products.noGroup}</option>
              {groups.map((g) => (
                <option key={g._id} value={g._id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label={t.suppliers.supplier} hint={t.suppliers.supplierHint}>
          <Segmented
            value={shownSupplier}
            onChange={setSupplier}
            options={(["coke", "sanMiguel", "other"] as const).map((key) => ({ value: key, label: t.suppliers.names[key] }))}
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
        {returnable && (
          <Field label={t.products.emptyValue} hint={t.products.emptyValueHint}>
            <PesoInput value={emptyValue} onChange={setEmptyValue} />
          </Field>
        )}
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

// Add, rename, remove and order the groups (Kasalo, C8, 1.5L…).
function GroupsModal({
  groups,
  products,
  onClose,
}: {
  groups: Doc<"productGroups">[];
  products: Doc<"products">[];
  onClose: () => void;
}) {
  const t = useT();
  const errorMessage = useErrorMessage();
  const create = useMutation(api.productGroups.create);
  const rename = useMutation(api.productGroups.rename);
  const move = useMutation(api.productGroups.move);
  const remove = useMutation(api.productGroups.remove);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function run(action: () => Promise<unknown>, success?: string) {
    try {
      await action();
      if (success) toast.success(success);
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    }
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return toast.error(t.products.needGroupName);
    setSaving(true);
    if (await run(() => create({ name: trimmed }), t.products.groupAdded(trimmed))) setName("");
    setSaving(false);
  }

  return (
    <Modal open onClose={onClose} title={t.products.groupsTitle} description={t.products.groupsHint}>
      <div className="space-y-5">
        {groups.length === 0 ? (
          <p className="text-base text-ink-3">{t.products.noGroups}</p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {groups.map((group, index) => (
              <GroupRow
                key={group._id}
                group={group}
                count={products.filter((p) => p.groupId === group._id).length}
                first={index === 0}
                last={index === groups.length - 1}
                onMove={(direction) => run(() => move({ groupId: group._id, direction }))}
                onRename={(newName) => run(() => rename({ groupId: group._id, name: newName }))}
                onRemove={() => {
                  if (window.confirm(t.products.removeGroupConfirm(group.name))) {
                    void run(() => remove({ groupId: group._id }), t.products.groupRemoved(group.name));
                  }
                }}
              />
            ))}
          </ul>
        )}
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
          <Field label={t.products.groupName} className="min-w-48 flex-1">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.products.groupPlaceholder} />
          </Field>
          <Button type="submit" size="lg" loading={saving}>
            <Plus className="size-6" strokeWidth={2.5} /> {t.products.addGroup}
          </Button>
        </form>
        <div className="flex justify-end">
          <Button variant="secondary" size="lg" onClick={onClose}>
            {t.common.done}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function GroupRow({
  group,
  count,
  first,
  last,
  onMove,
  onRename,
  onRemove,
}: {
  group: { _id: Id<"productGroups">; name: string };
  count: number;
  first: boolean;
  last: boolean;
  onMove: (direction: "up" | "down") => void;
  onRename: (name: string) => Promise<boolean>;
  onRemove: () => void;
}) {
  const t = useT();
  const [name, setName] = useState(group.name);
  async function save() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === group.name) return setName(group.name);
    if (!(await onRename(trimmed))) setName(group.name);
  }
  return (
    <li className="flex items-center gap-2 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), e.currentTarget.blur())}
          aria-label={t.products.renameGroup(group.name)}
        />
        <p className="mt-1 pl-1 text-sm text-ink-3">{t.products.inGroup(count)}</p>
      </div>
      <Button variant="ghost" size="sm" className="w-10 px-0" disabled={first} onClick={() => onMove("up")} aria-label={t.products.moveUp(group.name)}>
        <ArrowUp className="size-5" />
      </Button>
      <Button variant="ghost" size="sm" className="w-10 px-0" disabled={last} onClick={() => onMove("down")} aria-label={t.products.moveDown(group.name)}>
        <ArrowDown className="size-5" />
      </Button>
      <Button variant="ghost" size="sm" className="w-10 px-0 text-[#B42318]" onClick={onRemove} aria-label={t.products.removeGroup(group.name)}>
        <Trash2 className="size-5" />
      </Button>
    </li>
  );
}
