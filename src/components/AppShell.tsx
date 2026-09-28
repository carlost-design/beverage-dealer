import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Boxes,
  ClipboardCheck,
  Home,
  LogOut,
  Package,
  PackageOpen,
  Plus,
  ReceiptText,
  Search,
  Settings,
  Type,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { api } from "../../convex/_generated/api";
import { useFmt, useLang, useSetLanguage, useT, type Lang } from "../i18n";
import { cx } from "../lib/format";
import { useTextSize, type TextSize } from "../lib/textSize";
import { useToday } from "../lib/useToday";
import { LogoMark } from "./Logo";
import { Avatar, Chip, SearchField } from "./ui";

type Alerts = NonNullable<ReturnType<typeof useAlerts>>;

function useAlerts(today: string) {
  return useQuery(api.dashboard.alerts, { today });
}

export default function AppShell() {
  const t = useT();
  const today = useToday();
  const settings = useQuery(api.settings.get);
  const alerts = useAlerts(today) ?? undefined;
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    setSearchOpen(false);
  }, [location.pathname]);

  const businessName = settings?.businessName ?? "";
  // Step-by-step tasks hide the bottom tabs on small screens, so only their
  // own Back / Next bar is left at the bottom.
  const focusMode = /^\/(orders\/new|orders\/[^/]+\/edit|payments\/new|inventory\/(delivery|close))/.test(location.pathname);
  const nav: { to: string; label: string; icon: LucideIcon; end?: boolean; badge?: ReactNode }[] = [
    { to: "/", label: t.nav.home, icon: Home, end: true },
    {
      to: "/orders",
      label: t.nav.orders,
      icon: ReceiptText,
      badge: alerts && alerts.toDeliver > 0 ? <Chip tone="green">{alerts.toDeliver}</Chip> : null,
    },
    {
      to: "/clients",
      label: t.nav.clients,
      icon: Users,
      badge: alerts && alerts.lateCount > 0 ? <Chip tone="red" solid>{alerts.lateCount}</Chip> : null,
    },
    { to: "/inventory", label: t.nav.stock, icon: Boxes },
    { to: "/reports", label: t.nav.reports, icon: BarChart3 },
    { to: "/products", label: t.nav.products, icon: Package },
  ];

  return (
    <div
      className="min-h-dvh"
      style={focusMode ? ({ "--action-bar-bottom": "0px" } as React.CSSProperties) : undefined}
    >
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-line bg-white lg:flex">
        <Link to="/" className="flex items-center gap-3 px-6 pt-6 pb-6">
          <LogoMark className="size-11 shrink-0" />
          <span className="line-clamp-2 text-lg leading-tight font-bold text-ink">{businessName}</span>
        </Link>
        <nav className="space-y-1 px-4" aria-label={t.nav.menu}>
          {nav.map((item) => (
            <SideLink key={item.to} {...item} />
          ))}
        </nav>
        <div className="mx-6 my-4 border-t border-line" />
        <nav className="px-4">
          <SideLink to="/settings" label={t.nav.settings} icon={Settings} />
        </nav>
        <div className="mt-auto p-4">
          <DayCard alerts={alerts} />
        </div>
      </aside>

      {/* Top bar */}
      <header
        className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur lg:ml-72"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex h-18 items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-2.5 lg:hidden">
            <LogoMark className="size-10 shrink-0" />
            <span className="truncate text-lg font-bold text-ink">{businessName}</span>
          </Link>
          <div className="hidden w-full max-w-md lg:block">
            <GlobalSearch />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              aria-label={t.common.search}
              className="flex size-12 items-center justify-center rounded-full border border-line bg-white text-ink-2 hover:bg-gray-50 lg:hidden"
            >
              {searchOpen ? <X className="size-6" /> : <Search className="size-6" />}
            </button>
            <div className="hidden sm:block">
              <LanguageToggle />
            </div>
            <div className="hidden sm:block">
              <TextSizeMenu />
            </div>
            <AlertsMenu alerts={alerts} />
            <AccountMenu />
          </div>
        </div>
        {searchOpen && (
          <div className="border-t border-line px-4 py-3 lg:hidden">
            <GlobalSearch autoFocus />
          </div>
        )}
      </header>

      <main className="px-4 pt-6 pb-36 sm:px-6 lg:ml-72 lg:px-8 lg:pt-8 lg:pb-16">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>

      {/* Bottom tabs on phones and iPads */}
      {!focusMode && (
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label={t.nav.menu}
      >
        <div className="grid grid-cols-5 items-end">
          <TabLink to="/" label={t.nav.home} icon={Home} end />
          <TabLink to="/orders" label={t.nav.orders} icon={ReceiptText} />
          <Link to="/orders/new" className="flex flex-col items-center gap-1 pb-2" aria-label={t.nav.newOrder}>
            <span className="-mt-6 flex size-16 items-center justify-center rounded-full bg-brand text-white shadow-pop ring-4 ring-white">
              <Plus className="size-8" strokeWidth={2.5} />
            </span>
            <span className="text-sm font-semibold text-brand-strong">{t.nav.newShort}</span>
          </Link>
          <TabLink to="/clients" label={t.nav.clients} icon={Users} badge={alerts?.lateCount} />
          <TabLink to="/inventory" label={t.nav.stock} icon={Boxes} />
        </div>
      </nav>
      )}
    </div>
  );
}

function SideLink({
  to,
  label,
  icon: Icon,
  end,
  badge,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: ReactNode;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cx(
          "relative flex min-h-12 items-center gap-3 rounded-xl px-4 text-base font-medium transition-colors",
          isActive ? "bg-brand-soft font-semibold text-ink" : "text-ink-2 hover:bg-gray-50",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute top-2 bottom-2 -left-4 w-1 rounded-r-full bg-brand" aria-hidden />}
          <Icon className={cx("size-6", isActive ? "text-brand" : "text-ink-3")} strokeWidth={2} />
          <span className="flex-1">{label}</span>
          {badge}
        </>
      )}
    </NavLink>
  );
}

function TabLink({
  to,
  label,
  icon: Icon,
  end,
  badge,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: number;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cx("flex flex-col items-center gap-1 pt-2.5 pb-2", isActive ? "text-brand-strong" : "text-ink-3")
      }
    >
      <span className="relative">
        <Icon className="size-7" strokeWidth={2} />
        {badge ? (
          <span className="absolute -top-1.5 -right-3 min-w-6 rounded-full bg-red-600 px-1.5 text-center text-xs leading-6 font-bold text-white">
            {badge}
          </span>
        ) : null}
      </span>
      <span className="text-sm font-semibold">{label}</span>
    </NavLink>
  );
}

// The blue card at the bottom of the sidebar, where the reference puts its
// promo card: the one end-of-day job.
function DayCard({ alerts }: { alerts: Alerts | undefined }) {
  const t = useT();
  const fmt = useFmt();
  if (!alerts) return null;
  if (alerts.todayStatus === "closed") {
    return (
      <div className="rounded-2xl border border-[#ABEFC6] bg-[#ECFDF3] p-5">
        <p className="text-base font-bold text-[#054F31]">{t.home.dayClosed}</p>
        <p className="mt-1 text-sm text-[#146C43]">{t.stock.closedHint}</p>
      </div>
    );
  }
  const date = alerts.previousOpen;
  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#1D4ED8] to-[#2563EB] p-5 text-white shadow-pop">
      <span className="flex size-11 items-center justify-center rounded-xl bg-white/15">
        <ClipboardCheck className="size-6" />
      </span>
      <p className="mt-3 text-lg font-bold">{date ? t.home.notClosed(fmt.shortDate(date)) : t.home.closeDay}</p>
      <p className="mt-1 text-sm text-blue-50">{date ? t.home.notClosedHint : t.closeDay.instructions}</p>
      <Link
        to={date ? `/inventory/close?date=${date}` : "/inventory/close"}
        className="mt-4 flex h-12 items-center justify-center rounded-full bg-white text-base font-bold text-brand-strong hover:bg-blue-50"
      >
        {t.home.countAndClose}
      </Link>
    </div>
  );
}

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

const popoverPanel =
  "absolute right-0 top-full z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-white p-2 shadow-pop";

const roundButton =
  "relative flex size-12 items-center justify-center rounded-full border border-line bg-white text-ink-2 hover:bg-gray-50";

function LanguageToggle({ className }: { className?: string }) {
  const lang = useLang();
  const setLanguage = useSetLanguage();
  const options: { value: Lang; label: string }[] = [
    { value: "en", label: "English" },
    { value: "fil", label: "Filipino" },
  ];
  return (
    <div className={cx("inline-flex rounded-full border border-line bg-white p-1", className)} role="radiogroup" aria-label="Language / Wika">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={lang === option.value}
          onClick={() => setLanguage(option.value)}
          className={cx(
            "h-10 rounded-full px-4 text-base font-semibold",
            lang === option.value ? "bg-brand text-white" : "text-ink-2 hover:bg-gray-100",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function TextSizeMenu() {
  const t = useT();
  const { open, setOpen, ref } = usePopover();
  const [size, setSize] = useTextSize();
  const options: { value: TextSize; label: string; sample: string }[] = [
    { value: "normal", label: t.settings.sizeNormal, sample: "text-lg" },
    { value: "large", label: t.settings.sizeLarge, sample: "text-xl" },
    { value: "xl", label: t.settings.sizeXL, sample: "text-2xl" },
  ];
  return (
    <div className="relative" ref={ref}>
      <button type="button" className={roundButton} onClick={() => setOpen((v) => !v)} aria-label={t.settings.textSize} aria-expanded={open}>
        <Type className="size-6" />
      </button>
      {open && (
        <div className={popoverPanel}>
          <p className="px-3 pt-2 pb-1 text-base font-semibold text-ink">{t.settings.textSize}</p>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setSize(option.value)}
              className={cx(
                "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left",
                size === option.value ? "bg-brand-soft" : "hover:bg-gray-50",
              )}
            >
              <span className={cx("font-bold", option.sample)}>Aa</span>
              <span className="flex-1 text-base font-semibold text-ink">{option.label}</span>
              {size === option.value && <span className="size-3 rounded-full bg-brand" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TextSizeChoices() {
  const t = useT();
  const [size, setSize] = useTextSize();
  const options: { value: TextSize; label: string; sample: string }[] = [
    { value: "normal", label: t.settings.sizeNormal, sample: "text-base" },
    { value: "large", label: t.settings.sizeLarge, sample: "text-lg" },
    { value: "xl", label: t.settings.sizeXL, sample: "text-xl" },
  ];
  return (
    <div className="grid grid-cols-3 gap-1 rounded-2xl border border-line p-1" role="radiogroup" aria-label={t.settings.textSize}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={size === option.value}
          aria-label={option.label}
          onClick={() => setSize(option.value)}
          className={cx(
            "h-11 rounded-xl font-bold",
            option.sample,
            size === option.value ? "bg-brand text-white" : "text-ink-2 hover:bg-gray-100",
          )}
        >
          Aa
        </button>
      ))}
    </div>
  );
}

function AlertsMenu({ alerts }: { alerts: Alerts | undefined }) {
  const t = useT();
  const fmt = useFmt();
  const { open, setOpen, ref } = usePopover();
  const count = alerts ? alerts.lateCount + alerts.low.length + (alerts.previousOpen ? 1 : 0) : 0;
  return (
    <div className="relative" ref={ref}>
      <button type="button" className={roundButton} onClick={() => setOpen((v) => !v)} aria-label={`${t.home.latePayers}, ${t.home.runningLow}`} aria-expanded={open}>
        <Bell className="size-6" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-6 rounded-full bg-red-600 px-1.5 text-center text-xs leading-6 font-bold text-white">
            {count}
          </span>
        )}
      </button>
      {open && alerts && (
        <div className={popoverPanel}>
          {count === 0 ? (
            <p className="px-3 py-4 text-base text-ink-3">{t.home.noLate}</p>
          ) : (
            <ul className="divide-y divide-line">
              {alerts.previousOpen && (
                <AlertRow
                  to={`/inventory/close?date=${alerts.previousOpen}`}
                  icon={ClipboardCheck}
                  tone="amber"
                  title={t.home.notClosed(fmt.shortDate(alerts.previousOpen))}
                />
              )}
              {alerts.late.map((client) => (
                <AlertRow
                  key={client.clientId}
                  to={`/clients/${client.clientId}`}
                  icon={AlertTriangle}
                  tone="red"
                  title={client.name}
                  detail={`${fmt.money(client.lateBalance)} · ${t.status.late(client.daysLate)}`}
                />
              ))}
              {alerts.low.map((item) => (
                <AlertRow
                  key={item.productId}
                  to="/inventory"
                  icon={PackageOpen}
                  tone="amber"
                  title={t.home.lowItem(item.name, item.left)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function AlertRow({
  to,
  icon: Icon,
  tone,
  title,
  detail,
}: {
  to: string;
  icon: LucideIcon;
  tone: "red" | "amber";
  title: string;
  detail?: string;
}) {
  return (
    <li>
      <Link to={to} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-gray-50">
        <span
          className={cx(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            tone === "red" ? "bg-[#FDECEC] text-[#DC2626]" : "bg-[#FEF3E2] text-[#D97706]",
          )}
        >
          <Icon className="size-5" />
        </span>
        <span className="min-w-0">
          <span className={cx("block text-base font-semibold", tone === "red" ? "text-[#B42318]" : "text-ink")}>{title}</span>
          {detail && <span className="block text-sm text-ink-3">{detail}</span>}
        </span>
      </Link>
    </li>
  );
}

function AccountMenu() {
  const t = useT();
  const me = useQuery(api.users.me);
  const { signOut } = useAuthActions();
  const { open, setOpen, ref } = usePopover();
  const email = me?.email ?? "";
  const items = [
    { to: "/reports", label: t.nav.reports, icon: BarChart3, mobileOnly: true },
    { to: "/products", label: t.nav.products, icon: Package, mobileOnly: true },
    { to: "/settings", label: t.nav.settings, icon: Settings, mobileOnly: false },
  ];
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label={t.nav.menu} aria-expanded={open} className="rounded-full">
        <Avatar name={email || "?"} />
      </button>
      {open && (
        <div className={popoverPanel}>
          <p className="truncate px-3 pt-2 pb-2 text-sm text-ink-3">{email}</p>
          <div className="space-y-2 px-1 pb-2 sm:hidden">
            <LanguageToggle className="w-full justify-center" />
            <TextSizeChoices />
          </div>
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cx(
                "flex items-center gap-3 rounded-xl px-3 py-3 text-base font-semibold text-ink hover:bg-gray-50",
                item.mobileOnly && "lg:hidden",
              )}
            >
              <item.icon className="size-6 text-ink-3" /> {item.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-base font-semibold text-ink hover:bg-gray-50"
          >
            <LogOut className="size-6 text-ink-3" /> {t.nav.signOut}
          </button>
        </div>
      )}
    </div>
  );
}

// Finds clients by name or store, and orders by number.
function GlobalSearch({ autoFocus }: { autoFocus?: boolean }) {
  const t = useT();
  const fmt = useFmt();
  const today = useToday();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const term = query.trim().toLowerCase().replace(/^#/, "");
  const clients = useQuery(api.clients.list, term ? { today } : "skip");
  const orderNo = /^\d{3,}$/.test(term) ? Number(term) : null;
  const orderId = useQuery(api.orders.findByNumber, orderNo ? { orderNo } : "skip");
  const matches = (clients ?? [])
    .filter((c) => c.active && `${c.name} ${c.storeName ?? ""} ${c.phone ?? ""}`.toLowerCase().includes(term))
    .slice(0, 6);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function go(path: string) {
    setQuery("");
    setOpen(false);
    navigate(path);
  }

  return (
    <div className="relative" ref={wrap} onFocus={() => setOpen(true)}>
      <SearchField value={query} onChange={(v) => { setQuery(v); setOpen(true); }} placeholder={t.orders.searchPlaceholder} autoFocus={autoFocus} />
      {open && term && (
        <div className="absolute inset-x-0 top-full z-40 mt-2 rounded-2xl border border-line bg-white p-2 shadow-pop">
          {orderId && (
            <button type="button" onClick={() => go(`/orders/${orderId}`)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-gray-50">
              <ReceiptText className="size-6 text-brand" />
              <span className="text-base font-semibold">{t.orders.orderNo(orderNo!)}</span>
            </button>
          )}
          {matches.map((c) => (
            <button
              key={c._id}
              type="button"
              onClick={() => go(`/clients/${c._id}`)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-gray-50"
            >
              <Avatar name={c.name} late={c.daysLate > 0} />
              <span className="min-w-0 flex-1">
                <span className={cx("block truncate text-base font-semibold", c.daysLate > 0 ? "text-[#B42318]" : "text-ink")}>{c.name}</span>
                {c.storeName && <span className="block truncate text-sm text-ink-3">{c.storeName}</span>}
              </span>
              {c.balance > 0 && <span className="text-base font-semibold tabular">{fmt.money(c.balance)}</span>}
            </button>
          ))}
          {clients && matches.length === 0 && !orderId && <p className="px-3 py-3 text-base text-ink-3">{t.clients.noMatch}</p>}
        </div>
      )}
    </div>
  );
}
