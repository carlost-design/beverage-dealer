import { useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CircleHelp,
  CheckCircle2,
  ClipboardCheck,
  HandCoins,
  PackageOpen,
  Plus,
  ReceiptText,
  ShoppingCart,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { api } from "../../convex/_generated/api";
import { ProductTile } from "../components/ProductTile";
import { ClientName } from "../components/status";
import {
  Alert,
  Avatar,
  Card,
  CardHeader,
  Chip,
  EmptyState,
  IconTile,
  LinkButton,
  PageLoading,
  StatCard,
  type Tone,
} from "../components/ui";
import { useFmt, useT } from "../i18n";
import { cx, manilaHour } from "../lib/format";
import { useToday } from "../lib/useToday";
import { markWelcomeDone, readWelcomeDone, useTour, useTourPage } from "../tour/TourProvider";

export default function Home() {
  useTourPage("home");
  const t = useT();
  const fmt = useFmt();
  const today = useToday();
  const data = useQuery(api.dashboard.home, { today });
  const settings = useQuery(api.settings.get);

  if (!data || !settings) return <PageLoading />;
  const hour = manilaHour();
  const greeting =
    hour < 12 ? t.greeting.morning : hour < 13 ? t.greeting.noon : hour < 18 ? t.greeting.afternoon : t.greeting.evening;
  const needsSetup = !settings.hasBusinessName || data.setup.products === 0 || data.setup.clients === 0;
  const methods = Object.entries(data.today.collectedByMethod) as [keyof typeof t.methods, number][];
  const closeLink = data.stock.previousOpen ? `/inventory/close?date=${data.stock.previousOpen}` : "/inventory/close";

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">{greeting}!</h1>
          <p className="mt-1 text-lg text-ink-3">{fmt.day(today)}</p>
        </div>
        <div className="hidden lg:block">
          <LinkButton to="/orders/new" size="lg">
            <Plus className="size-6" strokeWidth={2.5} /> {t.home.newOrder}
          </LinkButton>
        </div>
      </div>

      <div className="space-y-3">
        <WelcomeTour />
        {needsSetup && <SetupCard hasName={settings.hasBusinessName} products={data.setup.products} clients={data.setup.clients} />}
        {data.stock.previousOpen && (
          <Alert
            tone="amber"
            icon={ClipboardCheck}
            title={t.home.notClosed(fmt.shortDate(data.stock.previousOpen))}
            action={
              <LinkButton to={closeLink} variant="secondary">
                {t.home.countAndClose}
              </LinkButton>
            }
          >
            {t.home.notClosedHint}
          </Alert>
        )}
        {data.stock.status === "closed" && (
          <Alert tone="green" icon={CheckCircle2} title={t.home.dayClosed}>
            {t.home.dayClosedHint}
          </Alert>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4" data-tour="home-tasks">
        <TaskButton tour="home-new-order" to="/orders/new" icon={ShoppingCart} label={t.home.newOrder} primary />
        <TaskButton tour="home-pay" to="/payments/new" icon={Wallet} label={t.home.receivePayment} tone="green" />
        <TaskButton tour="home-delivery" to="/inventory/delivery" icon={Truck} label={t.home.deliveryArrived} tone="orange" />
        <TaskButton tour="home-close" to={closeLink} icon={ClipboardCheck} label={t.home.closeDay} tone="violet" />
      </div>

      <h2 className="mt-9 mb-4 text-2xl font-bold tracking-tight text-ink">{t.home.today}</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-tour="home-today">
        <StatCard
          title={t.home.sales}
          icon={ReceiptText}
          tone="blue"
          value={fmt.moneyWhole(data.today.sales)}
          chip={<Chip tone="blue">{t.common.orders(data.today.orders)}</Chip>}
          caption={
            data.today.toDeliver > 0
              ? `${t.home.toDeliver}: ${t.common.orders(data.today.toDeliver)}`
              : `${t.common.yesterday}: ${fmt.money(data.yesterday.sales)}`
          }
          to="/orders"
        />
        <StatCard
          title={t.home.received}
          icon={Wallet}
          tone="green"
          value={fmt.moneyWhole(data.today.collected)}
          caption={
            methods.length > 0
              ? methods.map(([method, amount]) => `${t.methods[method]} ${fmt.money(amount)}`).join(" · ")
              : `${t.common.yesterday}: ${fmt.money(data.yesterday.collected)}`
          }
        />
        <StatCard
          title={t.home.totalUtang}
          icon={HandCoins}
          tone="orange"
          value={fmt.moneyWhole(data.utang.total)}
          caption={t.home.utangDetail(data.utang.clients)}
          to="/clients?filter=utang"
        />
        <StatCard
          title={t.home.latePayers}
          icon={AlertTriangle}
          tone="red"
          value={fmt.moneyWhole(data.utang.late)}
          valueTone={data.utang.late > 0 ? "red" : "default"}
          chip={data.lateCount > 0 ? <Chip tone="red" solid>{t.common.clients(data.lateCount)}</Chip> : undefined}
          caption={data.lateCount === 0 ? t.home.noLate : t.home.latePayersHint}
          to="/clients?filter=late"
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3" data-tour="home-late">
          <CardHeader
            title={t.home.latePayers}
            description={t.home.latePayersHint}
            action={
              <Link to="/orders?tab=unpaid" className="rounded-full px-3 py-1.5 text-base font-semibold text-brand-strong hover:bg-brand-soft">
                {t.home.seeAllUnpaid}
              </Link>
            }
          />
          {data.latePayers.length === 0 ? (
            <EmptyState icon={CheckCircle2} title={t.home.noLate} />
          ) : (
            <ul className="divide-y divide-line px-2 pb-2">
              {data.latePayers.map((client) => (
                <li key={client.clientId} className="flex flex-wrap items-center gap-3 rounded-xl px-3 py-3.5 sm:flex-nowrap">
                  <Link to={`/clients/${client.clientId}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={client.name} late />
                    <span className="min-w-0">
                      <ClientName name={client.name} isLate className="block truncate text-lg" />
                      <span className="block truncate text-sm text-ink-3">
                        {client.storeName ? `${client.storeName} · ` : ""}
                        {t.common.orders(client.orders)}
                      </span>
                    </span>
                  </Link>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-lg font-bold text-[#B42318] tabular">{fmt.money(client.lateBalance)}</p>
                      <Chip tone="red" solid>
                        {t.status.late(client.daysLate)}
                      </Chip>
                    </div>
                    <LinkButton to={`/payments/new?client=${client.clientId}`} variant="secondary" size="sm">
                      {t.home.collect}
                    </LinkButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2" data-tour="home-stock">
          <CardHeader
            title={t.reports.stockToday}
            description={`${t.stock.startShort} ${data.stock.starting} · ${t.stock.nowShort} ${data.stock.now} ${t.stock.casesUnit}`}
            action={
              <Link to="/inventory" className="rounded-full px-3 py-1.5 text-base font-semibold text-brand-strong hover:bg-brand-soft">
                {t.nav.stock}
              </Link>
            }
          />
          {data.stock.rows.length === 0 ? (
            <EmptyState icon={PackageOpen} title={t.stock.noProducts} action={<LinkButton to="/products">{t.stock.addProducts}</LinkButton>} />
          ) : (
            <ul className="max-h-[26rem] divide-y divide-line overflow-y-auto px-2 pb-2">
              {data.stock.rows.map((row) => {
                const low = row.lowStockLevel > 0 && row.expected <= row.lowStockLevel;
                return (
                  <li key={row.productId} className="flex items-center gap-3 px-3 py-2.5">
                    <ProductTile category={row.category} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-base font-medium text-ink">{row.name}</span>
                    {low && <Chip tone="amber">{t.stock.low}</Chip>}
                    <span className={cx("text-base font-bold tabular", low ? "text-[#93370D]" : "text-ink")}>{row.expected}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function TaskButton({
  tour,
  to,
  icon,
  label,
  primary = false,
  tone = "blue",
}: {
  tour: string;
  to: string;
  icon: LucideIcon;
  label: string;
  primary?: boolean;
  tone?: Tone;
}) {
  const Icon = icon;
  return (
    <Link
      to={to}
      data-tour={tour}
      className={cx(
        "group flex min-h-36 flex-col justify-between gap-4 rounded-2xl p-5 shadow-card transition-shadow hover:shadow-pop",
        primary ? "bg-brand text-white" : "border border-line bg-white text-ink",
      )}
    >
      {primary ? (
        <span className="flex size-14 items-center justify-center rounded-2xl bg-white/15">
          <Icon className="size-8" strokeWidth={2} />
        </span>
      ) : (
        <IconTile icon={icon} tone={tone} size="lg" />
      )}
      <span className="flex items-end justify-between gap-2">
        <span className="text-xl leading-tight font-bold">{label}</span>
        <ArrowRight className={cx("size-6 shrink-0 transition-transform group-hover:translate-x-1", primary ? "text-white" : "text-ink-3")} />
      </span>
    </Link>
  );
}

// Offers the walkthrough once per device, until it is taken or turned down.
function WelcomeTour() {
  const t = useT();
  const { start } = useTour();
  const [show, setShow] = useState(() => !readWelcomeDone());
  if (!show) return null;
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-gradient-to-br from-[#1D4ED8] to-[#2563EB] p-5 text-white shadow-pop sm:p-6">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/15">
        <CircleHelp className="size-8" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xl font-bold">{t.home.tourTitle}</p>
        <p className="mt-1 text-base text-blue-50">{t.home.tourHint}</p>
      </div>
      <div className="flex w-full flex-wrap gap-3 sm:w-auto">
        <button
          type="button"
          onClick={() => {
            setShow(false);
            start("home");
          }}
          className="flex h-12 flex-1 items-center justify-center rounded-full bg-white px-5 text-base font-bold text-brand-strong hover:bg-blue-50 sm:flex-none"
        >
          {t.home.tourStart}
        </button>
        <button
          type="button"
          onClick={() => {
            markWelcomeDone();
            setShow(false);
          }}
          className="flex h-12 items-center justify-center rounded-full px-4 text-base font-semibold text-white ring-1 ring-white/40 hover:bg-white/10"
        >
          {t.home.tourLater}
        </button>
      </div>
    </div>
  );
}

function SetupCard({ hasName, products, clients }: { hasName: boolean; products: number; clients: number }) {
  const t = useT();
  const steps = [
    { done: hasName, to: "/settings", label: t.home.setupName },
    { done: products > 0, to: "/products", label: t.home.setupProducts },
    { done: clients > 0, to: "/clients", label: t.home.setupClients },
  ];
  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold text-ink">{t.home.setupTitle}</h2>
      <ol className="mt-4 space-y-2">
        {steps.map((step, i) => (
          <li key={step.to}>
            {step.done ? (
              <span className="flex items-center gap-3 px-1 py-2 text-lg text-ink-3 line-through">
                <CheckCircle2 className="size-7 text-emerald-600" /> {step.label}
              </span>
            ) : (
              <Link to={step.to} className="flex items-center gap-3 rounded-xl px-1 py-2 text-lg font-semibold text-brand-strong hover:bg-brand-soft">
                <span className="flex size-7 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{i + 1}</span>
                {step.label}
                <ArrowRight className="size-5" />
              </Link>
            )}
          </li>
        ))}
      </ol>
      <Link to="/help" className="mt-3 inline-flex items-center gap-2 rounded-xl px-1 py-2 text-base font-semibold text-ink-3 hover:text-ink">
        <BookOpen className="size-5" /> {t.home.guideLink}
      </Link>
    </Card>
  );
}
