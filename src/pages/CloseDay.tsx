import { useMutation, useQuery } from "convex/react";
import { ClipboardCheck } from "lucide-react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { StockRow } from "../../convex/lib/dayView";
import { ProductTile } from "../components/ProductTile";
import { Alert, Button, Card, CardHeader, EmptyState, LinkButton, Modal, PageHeader, PageLoading, Stepper } from "../components/ui";
import { useErrorMessage, useFmt, useT } from "../i18n";
import { cx } from "../lib/format";
import { useToday } from "../lib/useToday";
import { useTourPage } from "../tour/TourProvider";

export default function CloseDay() {
  const t = useT();
  const fmt = useFmt();
  const today = useToday();
  const [params] = useSearchParams();
  const date = params.get("date") ?? today;
  const day = useQuery(api.inventory.day, { date });

  if (!day) return <PageLoading />;
  if (day.status === "closed") {
    return <EmptyState icon={ClipboardCheck} title={t.closeDay.alreadyClosed(fmt.shortDate(date))} action={<LinkButton to="/inventory">{t.closeDay.backToStock}</LinkButton>} />;
  }
  if (!day.isLatest || date > today) {
    return (
      <EmptyState title={t.closeDay.cantClose} action={<LinkButton to="/inventory">{t.closeDay.backToStock}</LinkButton>}>
        {t.closeDay.cantCloseHint}
      </EmptyState>
    );
  }
  return <CloseDayForm key={date} date={date} rows={day.rows} previousOpen={day.previousOpen} />;
}

function CloseDayForm({ date, rows, previousOpen }: { date: string; rows: StockRow[]; previousOpen: string | null }) {
  useTourPage("close-day");
  const t = useT();
  const fmt = useFmt();
  const errorMessage = useErrorMessage();
  const closeDay = useMutation(api.inventory.closeDay);
  const navigate = useNavigate();
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(rows.map((row) => [row.productId, Math.max(row.expected, 0)])),
  );
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  const variances = rows
    .map((row) => ({ ...row, diff: (counts[row.productId] ?? row.expected) - row.expected }))
    .filter((row) => row.diff !== 0);
  const short = variances.filter((row) => row.diff < 0).reduce((sum, row) => sum - row.diff, 0);
  const over = variances.filter((row) => row.diff > 0).reduce((sum, row) => sum + row.diff, 0);

  async function submit() {
    setSaving(true);
    try {
      await closeDay({ date, counts: rows.map((row) => ({ productId: row.productId, counted: counts[row.productId] ?? row.expected })) });
      toast.success(t.closeDay.closed(fmt.shortDate(date)));
      navigate("/inventory");
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(false);
      setConfirming(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl pb-40 lg:pb-28">
      <PageHeader title={t.closeDay.title} description={fmt.day(date)} back={{ to: "/inventory", label: t.nav.stock }} />
      {previousOpen && (
        <div className="mb-5">
          <Alert tone="amber" title={t.closeDay.alsoOpen(fmt.shortDate(previousOpen))}>
            {t.closeDay.alsoOpenHint(fmt.shortDate(previousOpen))}
          </Alert>
        </div>
      )}
      <Alert tone="blue" icon={ClipboardCheck} title={t.closeDay.instructions} />

      <Card className="mt-5" data-tour="close-list">
        <CardHeader title={t.closeDay.listTitle} description={t.closeDay.listHint} />
        <ul className="divide-y divide-line">
          {rows.map((row) => {
            const counted = counts[row.productId] ?? row.expected;
            const diff = counted - row.expected;
            return (
              <li key={row.productId} className={cx("flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 sm:px-6", diff < 0 && "bg-[#FEF3F2]", diff > 0 && "bg-[#FFFAEB]")}>
                <ProductTile category={row.category} />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold text-ink">{row.name}</p>
                  <p className="text-base text-ink-3">{t.closeDay.system(row.expected)}</p>
                  <p className={cx("text-base font-bold", diff === 0 && "text-[#146C43]", diff < 0 && "text-[#B42318]", diff > 0 && "text-[#93370D]")}>
                    {diff === 0 ? t.closeDay.matches : diff < 0 ? t.closeDay.missing(-diff) : t.closeDay.extra(diff)}
                  </p>
                </div>
                <Stepper
                  half
                  value={counted}
                  onChange={(n) => setCounts((c) => ({ ...c, [row.productId]: n }))}
                  label={t.closeDay.countedCases(row.name)}
                />
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="fixed inset-x-0 z-20 border-t border-line bg-white/95 backdrop-blur lg:left-72" style={{ bottom: "var(--action-bar-bottom)", paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <p className={cx("min-w-0 flex-1 text-base font-semibold", variances.length === 0 ? "text-[#146C43]" : "text-ink-2")}>
            {variances.length === 0 ? t.closeDay.allMatch : t.closeDay.shortOver(short, over)}
          </p>
          <Button size="lg" onClick={() => setConfirming(true)} data-tour="close-button">
            <ClipboardCheck className="size-6" /> {t.closeDay.close(fmt.shortDate(date))}
          </Button>
        </div>
      </div>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t.closeDay.confirmTitle(fmt.shortDate(date))}
        footer={
          <>
            <Button variant="secondary" size="lg" onClick={() => setConfirming(false)}>
              {t.common.cancel}
            </Button>
            <Button size="lg" onClick={submit} loading={saving}>
              {t.closeDay.confirm}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-base text-ink-2">
          <p>{t.closeDay.confirmBody}</p>
          {variances.length > 0 && (
            <ul className="space-y-1.5 rounded-2xl bg-canvas p-4">
              {variances.map((row) => (
                <li key={row.productId} className="flex justify-between gap-3">
                  <span>{row.name}</span>
                  <span className={row.diff < 0 ? "font-bold text-[#B42318]" : "font-bold text-[#93370D]"}>
                    {row.diff < 0 ? t.closeDay.missing(-row.diff) : t.closeDay.extra(row.diff)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
    </div>
  );
}
