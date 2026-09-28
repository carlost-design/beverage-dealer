import { useQuery } from "convex/react";
import { AlertTriangle, CalendarDays, Clock, Coins, Package, ReceiptText, ShieldCheck, Wallet } from "lucide-react";
import { Link } from "react-router";
import { api } from "../../convex/_generated/api";
import { TickGauge, TrendChart, WeekdayBars } from "../components/charts";
import { ProductTile } from "../components/ProductTile";
import { Avatar, Card, CardHeader, Chip, DeltaChip, EmptyState, IconTile, LinkButton, PageHeader, PageLoading, StatCard } from "../components/ui";
import { useFmt, useT } from "../i18n";
import { addDays, useToday } from "../lib/useToday";

function change(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export default function Reports() {
  const t = useT();
  const fmt = useFmt();
  const today = useToday();
  const data = useQuery(api.dashboard.reports, { today });
  if (!data) return <PageLoading />;
  const { current, previous } = data;
  const collectionRate = current.sales > 0 ? (current.collected / current.sales) * 100 : 0;
  const strip = [
    { label: t.reports.notDue, value: data.aging.notDue, icon: Clock, tone: "blue" as const, bar: "bg-[#3B82F6]", wash: "from-[#EEF3FF]" },
    {
      label: t.reports.late1to15,
      value: data.aging.late1to7 + data.aging.late8to15,
      icon: AlertTriangle,
      tone: "orange" as const,
      bar: "bg-[#F97316]",
      wash: "from-[#FFF1E7]",
    },
    {
      label: t.reports.lateOver15,
      value: data.aging.late16to30 + data.aging.late31plus,
      icon: AlertTriangle,
      tone: "red" as const,
      bar: "bg-[#EF4444]",
      wash: "from-[#FDECEC]",
    },
  ];

  return (
    <>
      <PageHeader
        title={t.reports.title}
        actions={
          <span className="inline-flex h-12 items-center gap-2 rounded-full border border-line bg-white px-5 text-base font-semibold text-ink-2 shadow-xs">
            <CalendarDays className="size-5 text-ink-3" />
            {fmt.shortDate(addDays(today, -29))} – {fmt.shortDate(today)}
          </span>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={t.reports.salesKpi}
          icon={ReceiptText}
          tone="blue"
          value={fmt.moneyWhole(current.sales)}
          chip={<DeltaChip value={change(current.sales, previous.sales)} />}
          caption={t.reports.vsBefore(fmt.money(previous.sales))}
        />
        <StatCard
          title={t.reports.paymentsKpi}
          icon={Wallet}
          tone="green"
          value={fmt.moneyWhole(current.collected)}
          chip={<DeltaChip value={change(current.collected, previous.collected)} />}
          caption={t.reports.vsBefore(fmt.money(previous.collected))}
        />
        <StatCard
          title={t.reports.profitKpi}
          icon={Coins}
          tone="violet"
          value={fmt.moneyWhole(current.profit)}
          chip={<DeltaChip value={change(current.profit, previous.profit)} />}
          caption={t.reports.vsBefore(fmt.money(previous.profit))}
        />
        <StatCard
          title={t.reports.casesKpi}
          icon={Package}
          tone="orange"
          value={current.cases.toLocaleString("en-US")}
          chip={<DeltaChip value={change(current.cases, previous.cases)} />}
          caption={t.reports.vsBefore(previous.cases.toLocaleString("en-US"))}
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title={t.reports.salesAndPayments} description={t.reports.last30} />
          <div className="px-5 pb-5 sm:px-6">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <p className="text-[2.5rem] leading-none font-bold tracking-tight text-ink">{fmt.moneyWhole(current.sales)}</p>
              <DeltaChip value={change(current.sales, previous.sales)} />
            </div>
            <TrendChart data={data.trend} />

            <div className="mt-6 rounded-2xl border border-line p-4 sm:p-5">
              <p className="mb-3 text-base font-semibold text-ink">
                {t.reports.utangStripTitle}: {fmt.money(data.utang)}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {strip.map((part) => (
                  <div key={part.label} className={`flex flex-col justify-between overflow-hidden rounded-xl bg-gradient-to-b ${part.wash} to-white`}>
                    <div className="flex items-center gap-3 px-3 pt-3 pb-3">
                      <IconTile icon={part.icon} tone={part.tone} size="sm" />
                      <div className="min-w-0">
                        <p className="text-xl font-bold tabular">{fmt.money(part.value)}</p>
                        <p className="text-sm text-ink-3">{part.label}</p>
                      </div>
                    </div>
                    <span className={`h-2 w-full rounded-full ${part.bar}`} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title={t.reports.busiestDays} description={t.reports.busiestHint} />
            <div className="px-5 pb-5 sm:px-6">
              <WeekdayBars data={data.weekdays} />
            </div>
          </Card>
          <Card>
            <CardHeader title={t.reports.collectionRate} description={t.reports.collectionHint} />
            <div className="px-5 pb-5 sm:px-6">
              <TickGauge percent={collectionRate} label={t.reports.collectionRate} caption={t.reports.collectionCaption} />
              <div className="mt-2 flex justify-center">
                <LinkButton to="/clients?filter=utang" variant="secondary" size="sm">
                  <ShieldCheck className="size-5" /> {t.reports.showUtang}
                </LinkButton>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title={t.reports.bestSellers} description={t.reports.last30Label} />
          {data.bestSellers.length === 0 ? (
            <EmptyState title={t.reports.noSales} />
          ) : (
            <div className="overflow-x-auto px-2 pb-3">
              <table className="w-full min-w-[30rem] text-base">
                <thead>
                  <tr className="border-b border-line text-left text-sm tracking-wide text-ink-3 uppercase">
                    <th className="px-3 py-3 font-semibold">{t.reports.colProduct}</th>
                    <th className="px-3 py-3 text-right font-semibold">{t.reports.colCases}</th>
                    <th className="px-3 py-3 text-right font-semibold">{t.reports.colSales}</th>
                    <th className="px-3 py-3 text-right font-semibold">{t.reports.colInStock}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line tabular">
                  {data.bestSellers.map((row) => (
                    <tr key={row.productId}>
                      <td className="px-3 py-3">
                        <span className="flex items-center gap-3">
                          <ProductTile category={row.category} size="sm" />
                          <span className="font-semibold text-ink">{row.name}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">{row.cases}</td>
                      <td className="px-3 py-3 text-right font-semibold">{fmt.money(row.sales)}</td>
                      <td className="px-3 py-3 text-right">{row.inStock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title={t.reports.topClients} description={t.reports.last30Label} />
          {data.topClients.length === 0 ? (
            <EmptyState title={t.reports.noSales} />
          ) : (
            <ul className="divide-y divide-line px-2 pb-3">
              {data.topClients.map((client, i) => (
                <li key={client.clientId}>
                  <Link to={`/clients/${client.clientId}`} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-gray-50">
                    <span className="w-6 text-center text-base font-semibold text-ink-3 tabular">{i + 1}</span>
                    <Avatar name={client.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-semibold text-ink">{client.name}</span>
                      {client.storeName && <span className="block truncate text-sm text-ink-3">{client.storeName}</span>}
                    </span>
                    <Chip tone="gray">{t.common.orders(client.orders)}</Chip>
                    <span className="text-base font-bold tabular">{fmt.money(client.sales)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader title={t.reports.emptiesTitle} />
        <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 sm:px-6">
          <p className="rounded-xl bg-gray-50 px-4 py-3 text-base text-ink-2">{t.reports.emptiesInStorage(data.empties.onHand)}</p>
          <p className="rounded-xl bg-gray-50 px-4 py-3 text-base text-ink-2">{t.reports.emptiesOwed(data.empties.owedByClients)}</p>
        </div>
      </Card>
    </>
  );
}
