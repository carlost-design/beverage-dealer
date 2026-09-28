import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Boxes, CheckCircle2, Home as HomeIcon, Pencil, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { ProductTile } from "../components/ProductTile";
import {
  Alert,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  LinkButton,
  PageHeader,
  PageLoading,
  PesoInput,
  Stepper,
} from "../components/ui";
import { useErrorMessage, useFmt, useT } from "../i18n";
import { parsePeso, pesoInput } from "../lib/format";
import { useToday } from "../lib/useToday";

type Line = { quantity: number; cost: string; costOpen: boolean; empties: number };

export default function DeliveryArrived() {
  const t = useT();
  const fmt = useFmt();
  const errorMessage = useErrorMessage();
  const today = useToday();
  const products = useQuery(api.products.list);
  const day = useQuery(api.inventory.day, { date: today });
  const stockIn = useMutation(api.inventory.stockIn);
  const [supplier, setSupplier] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<Record<string, Line>>({});
  const [saving, setSaving] = useState(false);
  const [savedCases, setSavedCases] = useState<number | null>(null);

  if (!products || !day) return <PageLoading />;
  const active = products.filter((p) => p.active);
  const nowOf = new Map(day.rows.map((row) => [row.productId, row.expected]));
  const line = (p: Doc<"products">) => lines[p._id] ?? { quantity: 0, cost: pesoInput(p.cost), costOpen: false, empties: 0 };
  const update = (p: Doc<"products">, change: Partial<Line>) => setLines((all) => ({ ...all, [p._id]: { ...line(p), ...change } }));
  const totalCases = active.reduce((sum, p) => sum + line(p).quantity, 0);
  const totalCost = active.reduce((sum, p) => sum + line(p).quantity * (parsePeso(line(p).cost) ?? 0), 0);
  const returnable = active.filter((p) => p.returnable);

  if (savedCases !== null) {
    return (
      <div className="mx-auto max-w-xl py-4 text-center">
        <span className="mx-auto flex size-24 items-center justify-center rounded-full bg-[#E8F7EE] text-[#16A34A]">
          <CheckCircle2 className="size-14" />
        </span>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-ink">{t.delivery.saved(savedCases)}</h1>
        <div className="mt-8 flex flex-col gap-3">
          <LinkButton to="/inventory" size="lg" variant="secondary">
            <Boxes className="size-6" /> {t.nav.stock}
          </LinkButton>
          <LinkButton to="/" size="lg">
            <HomeIcon className="size-6" /> {t.flow.goHome}
          </LinkButton>
        </div>
      </div>
    );
  }

  async function save() {
    const items = [];
    const emptiesReturned = [];
    for (const p of active) {
      const l = line(p);
      if (l.quantity > 0) {
        const cost = parsePeso(l.cost);
        if (cost === null) return toast.error(t.delivery.checkCost(p.name));
        items.push({ productId: p._id, quantity: l.quantity, cost });
      }
      if (l.empties > 0) emptiesReturned.push({ productId: p._id, quantity: l.empties });
    }
    if (items.length === 0 && emptiesReturned.length === 0) return toast.error(t.delivery.nothing);
    setSaving(true);
    try {
      await stockIn({ supplier, reference, items, emptiesReturned });
      setSavedCases(totalCases);
      window.scrollTo(0, 0);
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl pb-40 lg:pb-28">
      <PageHeader title={t.delivery.title} description={t.delivery.hint} back={{ to: "/inventory", label: t.nav.stock }} />
      {day.status === "closed" && (
        <div className="mb-5">
          <Alert tone="red" title={t.stock.closedTitle}>
            {t.home.dayClosedHint}
          </Alert>
        </div>
      )}

      <Card className="mb-5 grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        <Field label={t.delivery.supplier} hint={t.common.optional}>
          <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder={t.delivery.supplierPlaceholder} />
        </Field>
        <Field label={t.delivery.reference} hint={t.common.optional}>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
      </Card>

      <Card className="mb-5">
        <CardHeader title={t.delivery.casesReceived} />
        {active.length === 0 ? (
          <EmptyState title={t.stock.noProducts} action={<LinkButton to="/products">{t.stock.addProducts}</LinkButton>} />
        ) : (
          <ul className="divide-y divide-line">
            {active.map((p) => {
              const l = line(p);
              return (
                <li key={p._id} className="px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                    <ProductTile category={p.category} />
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-bold text-ink">{p.name}</p>
                      <p className="text-base text-ink-3">
                        {t.stock.nowShort}: {t.common.cases(nowOf.get(p._id) ?? 0)}
                      </p>
                    </div>
                    <Stepper value={l.quantity} onChange={(q) => update(p, { quantity: q })} label={`${t.delivery.casesReceived}: ${p.name}`} />
                  </div>
                  {l.quantity > 0 && (
                    <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
                      {l.costOpen ? (
                        <label className="flex items-center gap-3 text-base font-semibold text-ink-2">
                          {t.delivery.costPerCase}
                          <PesoInput value={l.cost} onChange={(cost) => update(p, { cost })} className="w-40" />
                        </label>
                      ) : (
                        <>
                          <span className="text-base text-ink-3">
                            {t.delivery.costPerCase}: <span className="font-semibold text-ink-2 tabular">{fmt.money(parsePeso(l.cost) ?? 0)}</span>
                          </span>
                          <Button variant="ghost" size="sm" onClick={() => update(p, { costOpen: true })}>
                            <Pencil className="size-4" /> {t.delivery.changeCost}
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {returnable.length > 0 && (
        <Card>
          <CardHeader title={t.delivery.emptiesGiven} description={t.stock.emptiesHint} />
          <ul className="divide-y divide-line">
            {returnable.map((p) => (
              <li key={p._id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 sm:px-6">
                <ProductTile category={p.category} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold text-ink">{p.name}</p>
                  <p className="text-base text-ink-3">{t.warehouseEmpties.onHand(p.emptiesOnHand)}</p>
                </div>
                <Stepper
                  size="sm"
                  value={line(p).empties}
                  max={p.emptiesOnHand}
                  onChange={(n) => update(p, { empties: n })}
                  label={`${t.delivery.emptiesGiven}: ${p.name}`}
                />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="fixed inset-x-0 z-20 border-t border-line bg-white/95 backdrop-blur lg:left-72" style={{ bottom: "var(--action-bar-bottom)", paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <LinkButton to="/inventory" variant="secondary" size="lg" aria-label={t.common.back}>
            <ArrowLeft className="size-6" /> <span className="hidden sm:inline">{t.common.back}</span>
          </LinkButton>
          <p className="min-w-0 flex-1 text-right text-lg font-bold tabular">{totalCases > 0 ? t.delivery.summary(totalCases, fmt.money(totalCost)) : ""}</p>
          <Button size="lg" onClick={save} loading={saving} disabled={day.status === "closed"}>
            <Truck className="size-6" /> {t.delivery.save}
          </Button>
        </div>
      </div>
    </div>
  );
}
