import { usePaginatedQuery, useQuery } from "convex/react";
import { Plus, ReceiptText } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { api } from "../../convex/_generated/api";
import type { OrderRow } from "../../convex/orders";
import { DateNav } from "../components/DateNav";
import { ClientName, FulfillmentBadge, PaymentBadge } from "../components/status";
import { Avatar, Button, Card, EmptyState, LinkButton, PageHeader, PageLoading, SearchField, Segmented } from "../components/ui";
import { useFmt, useT } from "../i18n";
import { cx } from "../lib/format";
import { useToday } from "../lib/useToday";

type Tab = "today" | "unpaid" | "all";

export default function Orders() {
  const t = useT();
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const tab = (["today", "unpaid", "all"].includes(params.get("tab") ?? "") ? params.get("tab") : "today") as Tab;
  const date = params.get("date") ?? today;
  const [search, setSearch] = useState("");
  const [lateOnly, setLateOnly] = useState(false);

  const byDate = useQuery(api.orders.listByDate, tab === "today" ? { date, today } : "skip");
  const open = useQuery(api.orders.listOpen, tab === "unpaid" ? { today } : "skip");
  const recent = usePaginatedQuery(api.orders.listRecent, tab === "all" ? { today } : "skip", { initialNumItems: 30 });

  const setTab = (next: Tab) => setParams(next === "today" ? {} : { tab: next });
  const setDate = (next: string) => setParams(next === today ? {} : { date: next });

  const source = tab === "today" ? byDate : tab === "unpaid" ? open : recent.results;
  const loading = tab === "all" ? recent.status === "LoadingFirstPage" : source === undefined || source === null;
  const term = search.trim().toLowerCase().replace(/^#/, "");
  const rows = (source ?? []).filter(
    (order) =>
      (!lateOnly || tab !== "unpaid" || order.isLate) &&
      (!term ||
        String(order.orderNo).includes(term) ||
        order.clientName.toLowerCase().includes(term) ||
        order.storeName?.toLowerCase().includes(term)),
  );

  return (
    <>
      <PageHeader
        title={t.orders.title}
        actions={
          <LinkButton to="/orders/new" size="lg">
            <Plus className="size-6" strokeWidth={2.5} /> {t.nav.newOrder}
          </LinkButton>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Segmented
          label={t.orders.title}
          value={tab}
          onChange={setTab}
          options={[
            { value: "today", label: t.orders.byDay },
            { value: "unpaid", label: t.orders.unpaid },
            { value: "all", label: t.orders.all },
          ]}
        />
        <SearchField value={search} onChange={setSearch} placeholder={t.orders.searchPlaceholder} className="lg:max-w-md lg:flex-1" />
      </div>

      {tab === "today" && (
        <div className="mb-4">
          <DateNav date={date} today={today} onChange={setDate} />
        </div>
      )}
      {tab === "unpaid" && open && <UnpaidSummary rows={open} lateOnly={lateOnly} onLateOnly={setLateOnly} />}

      <Card>
        {loading ? (
          <div className="p-6">
            <PageLoading />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title={term ? t.orders.emptySearch : tab === "unpaid" ? t.orders.emptyUnpaid : tab === "today" ? t.orders.emptyDay : t.orders.emptyAll}
            action={
              !term && tab !== "unpaid" ? (
                <LinkButton to="/orders/new">
                  <Plus className="size-5" /> {t.nav.newOrder}
                </LinkButton>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-line p-2">
            {rows.map((order) => (
              <li key={order._id}>
                <OrderRowLink order={order} showDate={tab !== "today"} />
              </li>
            ))}
          </ul>
        )}
        {tab === "all" && recent.status === "CanLoadMore" && (
          <div className="border-t border-line p-3 text-center">
            <Button variant="ghost" onClick={() => recent.loadMore(30)}>
              {t.common.showMore}
            </Button>
          </div>
        )}
      </Card>
      {tab === "today" && byDate && byDate.length > 0 && <DayTotals rows={byDate} />}
    </>
  );
}

function UnpaidSummary({ rows, lateOnly, onLateOnly }: { rows: OrderRow[]; lateOnly: boolean; onLateOnly: (value: boolean) => void }) {
  const t = useT();
  const fmt = useFmt();
  const balance = rows.reduce((sum, o) => sum + o.total - o.amountPaid, 0);
  const late = rows.filter((o) => o.isLate);
  const lateBalance = late.reduce((sum, o) => sum + o.total - o.amountPaid, 0);
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-lg text-ink-2">
        <span className="font-bold text-ink">{t.orders.unpaidSummary(fmt.money(balance), rows.length)}</span>
        {late.length > 0 && <span className="font-bold text-[#B42318]"> · {t.orders.lateSummary(fmt.money(lateBalance))}</span>}
      </p>
      <Segmented
        value={lateOnly ? "late" : "all"}
        onChange={(v) => onLateOnly(v === "late")}
        options={[
          { value: "all", label: t.orders.allUnpaid },
          { value: "late", label: t.orders.lateOnly(late.length) },
        ]}
      />
    </div>
  );
}

function DayTotals({ rows }: { rows: OrderRow[] }) {
  const t = useT();
  const fmt = useFmt();
  const active = rows.filter((o) => !o.voided);
  return (
    <p className="mt-4 text-right text-base text-ink-2">
      {t.orders.dayTotals(
        active.length,
        active.reduce((s, o) => s + o.cases, 0),
        fmt.money(active.reduce((s, o) => s + o.total, 0)),
        fmt.money(active.reduce((s, o) => s + o.amountPaid, 0)),
      )}
    </p>
  );
}

export function OrderRowLink({ order, showDate }: { order: OrderRow; showDate?: boolean }) {
  const t = useT();
  const fmt = useFmt();
  const balance = order.total - order.amountPaid;
  return (
    <Link
      to={`/orders/${order._id}`}
      className={cx(
        "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl px-3 py-3.5 transition-colors sm:flex-nowrap",
        order.isLate ? "bg-[#FEF3F2] hover:bg-[#FDE8E6]" : "hover:bg-gray-50",
        order.voided && "opacity-60",
      )}
    >
      <Avatar name={order.clientName} late={order.clientIsLate} />
      <div className="min-w-0 flex-1">
        <ClientName name={order.clientName} isLate={order.clientIsLate} className="block truncate text-lg" />
        <p className="truncate text-base text-ink-3">
          {[`#${order.orderNo}`, order.storeName, t.common.cases(order.cases), showDate ? fmt.shortDate(order.date) : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <PaymentBadge status={order.paymentStatus} isLate={order.isLate} daysLate={order.daysLate} voided={order.voided} />
          {!order.voided && <FulfillmentBadge fulfillment={order.fulfillment} status={order.fulfillmentStatus} />}
        </div>
      </div>
      <div className="ml-auto text-right">
        <p className={cx("text-xl font-bold text-ink tabular", order.voided && "line-through")}>{fmt.money(order.total)}</p>
        {order.paymentStatus === "partial" && !order.voided && (
          <p className="text-sm font-semibold text-ink-3 tabular">{t.orders.balance(fmt.money(balance))}</p>
        )}
        {order.paymentStatus !== "paid" && !order.voided && (
          <p className={cx("text-sm", order.isLate ? "font-bold text-[#B42318]" : "text-ink-3")}>{t.orders.due(fmt.shortDate(order.dueDate))}</p>
        )}
      </div>
    </Link>
  );
}
