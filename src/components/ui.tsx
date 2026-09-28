import { ChevronLeft, Loader2, Minus, Plus, Search, TrendingDown, TrendingUp, X } from "lucide-react";
import {
  useEffect,
  useId,
  type ButtonHTMLAttributes,
  type ComponentType,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { Link, type LinkProps } from "react-router";
import { useT } from "../i18n";
import { cx } from "../lib/format";

type IconType = ComponentType<{ className?: string; strokeWidth?: number }>;

/* ---------- Buttons ---------- */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "soft";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-white shadow-sm hover:bg-brand-strong active:bg-brand-strong disabled:bg-blue-300",
  secondary:
    "bg-white text-ink border border-line-strong shadow-sm hover:bg-gray-50 active:bg-gray-100 disabled:text-gray-400",
  ghost: "text-ink-2 hover:bg-gray-100 active:bg-gray-200 disabled:text-gray-400",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800 disabled:bg-red-300",
  success: "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-emerald-300",
  soft: "bg-brand-soft text-brand-strong hover:bg-blue-100 active:bg-blue-100",
};

const SIZES: Record<Size, string> = {
  sm: "h-10 px-4 text-sm gap-1.5",
  md: "h-12 px-5 text-base gap-2",
  lg: "h-14 px-7 text-lg gap-2.5",
};

function buttonClass(variant: Variant, size: Size, className?: string) {
  return cx(
    "inline-flex shrink-0 items-center justify-center rounded-full font-semibold whitespace-nowrap transition-colors select-none",
    "disabled:cursor-not-allowed [&_svg]:shrink-0",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="size-5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: LinkProps & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

/* ---------- Form controls ---------- */

export const inputClass =
  "block w-full rounded-xl border border-line-strong bg-white px-4 text-base text-ink shadow-xs placeholder:text-gray-500 focus:border-brand focus:ring-4 focus:ring-blue-100 focus:outline-none disabled:bg-gray-50 disabled:text-gray-500";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(inputClass, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(inputClass, "min-h-24 py-3", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(inputClass, "h-12 pr-10", className)} {...props}>
      {children}
    </select>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  className,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className={cx("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-3" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
        className="h-12 w-full rounded-full border border-line bg-white pr-4 pl-12 text-base text-ink shadow-xs placeholder:text-gray-500 focus:border-brand focus:ring-4 focus:ring-blue-100 focus:outline-none"
      />
    </div>
  );
}

export function PesoInput({
  value,
  onChange,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={cx("relative", className)}>
      <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center font-semibold text-ink-3">₱</span>
      <Input
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9 font-semibold tabular"
        {...props}
      />
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-2 block text-base font-semibold text-ink-2">{label}</span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-sm font-medium text-red-700">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-sm text-ink-3">{hint}</span>
      ) : null}
    </label>
  );
}

/* ---------- Surfaces ---------- */

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("rounded-2xl border border-line bg-white shadow-card", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-3 sm:px-6">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-ink-3">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* ---------- Chips, tiles, avatars ---------- */

export type Tone = "gray" | "green" | "red" | "amber" | "blue" | "orange" | "violet";

const CHIP_TONES: Record<Tone, string> = {
  gray: "bg-[#F2F4F7] text-[#344054]",
  green: "bg-[#E8F7EE] text-[#146C43]",
  red: "bg-[#FDECEC] text-[#B42318]",
  amber: "bg-[#FEF3E2] text-[#93370D]",
  blue: "bg-brand-soft text-brand-strong",
  orange: "bg-[#FFF1E7] text-[#9A3412]",
  violet: "bg-[#F3EEFF] text-[#5B21B6]",
};

export function Chip({
  tone = "gray",
  solid = false,
  icon: Icon,
  children,
  className,
}: {
  tone?: Tone;
  solid?: boolean;
  icon?: IconType;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap",
        solid ? (tone === "red" ? "bg-red-600 text-white" : "bg-ink text-white") : CHIP_TONES[tone],
        className,
      )}
    >
      {Icon && <Icon className="size-4" strokeWidth={2.5} />}
      {children}
    </span>
  );
}

// Change versus a previous period, like the reference's ▲ 15.5% chips.
export function DeltaChip({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null || !Number.isFinite(value)) return null;
  const up = value >= 0;
  const good = invert ? !up : up;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <Chip tone={good ? "green" : "red"} icon={Icon}>
      {Math.abs(value).toFixed(Math.abs(value) < 10 ? 1 : 0)}%
    </Chip>
  );
}

const TILE_TONES: Record<Tone, string> = {
  gray: "bg-[#F2F4F7] text-[#475467]",
  green: "bg-[#E8F7EE] text-[#16A34A]",
  red: "bg-[#FDECEC] text-[#DC2626]",
  amber: "bg-[#FEF3E2] text-[#D97706]",
  blue: "bg-brand-soft text-brand",
  orange: "bg-[#FFF1E7] text-[#EA580C]",
  violet: "bg-[#F3EEFF] text-[#7C3AED]",
};

export function IconTile({
  icon: Icon,
  tone = "blue",
  size = "md",
  className,
}: {
  icon: IconType;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const box = size === "sm" ? "size-9 rounded-lg" : size === "lg" ? "size-14 rounded-2xl" : "size-11 rounded-xl";
  const glyph = size === "sm" ? "size-5" : size === "lg" ? "size-7" : "size-6";
  return (
    <span className={cx("inline-flex shrink-0 items-center justify-center", box, TILE_TONES[tone], className)} aria-hidden>
      <Icon className={glyph} strokeWidth={2} />
    </span>
  );
}

const AVATAR_TONES = [
  "bg-[#EEF3FF] text-[#1D4ED8]",
  "bg-[#E8F7EE] text-[#146C43]",
  "bg-[#FFF1E7] text-[#9A3412]",
  "bg-[#F3EEFF] text-[#5B21B6]",
  "bg-[#E6F6F7] text-[#0E7490]",
  "bg-[#FDEEF6] text-[#9D174D]",
];

export function Avatar({ name, late = false, size = "md" }: { name: string; late?: boolean; size?: "md" | "lg" }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold",
        size === "lg" ? "size-16 text-xl" : "size-11 text-base",
        late ? "bg-[#FDECEC] text-[#B42318] ring-2 ring-red-300" : AVATAR_TONES[hash % AVATAR_TONES.length],
      )}
    >
      {initials || "?"}
    </span>
  );
}

/* ---------- Banners and page chrome ---------- */

const ALERT_TONES = {
  amber: { box: "bg-[#FFFAEB] border-[#FEDF89]", tile: "amber" as Tone, title: "text-[#7A2E0E]", body: "text-[#93370D]" },
  red: { box: "bg-[#FEF3F2] border-[#FECDCA]", tile: "red" as Tone, title: "text-[#7A271A]", body: "text-[#B42318]" },
  blue: { box: "bg-[#EFF4FF] border-[#C7D7FE]", tile: "blue" as Tone, title: "text-[#1E3A8A]", body: "text-[#1D4ED8]" },
  green: { box: "bg-[#ECFDF3] border-[#ABEFC6]", tile: "green" as Tone, title: "text-[#054F31]", body: "text-[#146C43]" },
};

export function Alert({
  tone = "amber",
  icon,
  title,
  children,
  action,
}: {
  tone?: keyof typeof ALERT_TONES;
  icon?: IconType;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const style = ALERT_TONES[tone];
  return (
    <div className={cx("flex flex-wrap items-center gap-4 rounded-2xl border px-5 py-4", style.box)}>
      {icon && <IconTile icon={icon} tone={style.tile} />}
      <div className="min-w-0 flex-1">
        <p className={cx("text-base font-semibold", style.title)}>{title}</p>
        {children && <div className={cx("mt-0.5 text-base", style.body)}>{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="mb-3 inline-flex h-10 items-center gap-1 rounded-full pr-4 pl-2 text-base font-semibold text-ink-3 hover:bg-white hover:text-ink"
    >
      <ChevronLeft className="size-5" aria-hidden /> {label}
    </Link>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
}) {
  return (
    <div className="mb-6">
      {back && <BackLink {...back} />}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight text-ink">{title}</h1>
          {description && <div className="mt-1 text-base text-ink-3">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon?: IconType;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {Icon && <IconTile icon={Icon} tone="gray" size="lg" className="mb-4" />}
      <p className="text-lg font-semibold text-ink">{title}</p>
      {children && <p className="mt-1 max-w-md text-base text-ink-3">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx("size-6 animate-spin text-ink-3", className)} aria-label="Loading" />;
}

// Placeholder blocks in the shape of the page, instead of a spinner in the middle.
export function PageLoading() {
  return (
    <div className="animate-pulse space-y-5" aria-busy="true">
      <div className="h-10 w-64 rounded-xl bg-gray-200" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-2xl bg-white shadow-card" />
        ))}
      </div>
      <div className="h-72 rounded-2xl bg-white shadow-card" />
    </div>
  );
}

// Reference-style number card: title, icon in the corner, big value, change chip.
export function StatCard({
  title,
  icon,
  tone = "blue",
  value,
  valueTone = "default",
  chip,
  caption,
  to,
}: {
  title: ReactNode;
  icon: IconType;
  tone?: Tone;
  value: ReactNode;
  valueTone?: "default" | "red" | "green";
  chip?: ReactNode;
  caption?: ReactNode;
  to?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-base font-semibold text-ink-2">{title}</p>
        <IconTile icon={icon} tone={tone} size="sm" />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <p
          className={cx(
            "text-[2rem] leading-tight font-bold tracking-tight",
            valueTone === "red" && "text-[#B42318]",
            valueTone === "green" && "text-[#146C43]",
          )}
        >
          {value}
        </p>
        {chip}
      </div>
      {caption && <p className="mt-1 text-sm text-ink-3">{caption}</p>}
    </>
  );
  const box = "block rounded-2xl border border-line bg-white p-5 shadow-card";
  return to ? (
    <Link to={to} className={cx(box, "transition-shadow hover:shadow-pop")}>
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  );
}

/* ---------- Choices ---------- */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cx("inline-flex max-w-full flex-wrap gap-1 rounded-full border border-line bg-white p-1 shadow-xs", className)}
      role="radiogroup"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cx(
            "min-h-10 rounded-full px-4 text-base font-semibold whitespace-nowrap transition-colors",
            value === option.value ? "bg-brand text-white shadow-sm" : "text-ink-2 hover:bg-gray-100",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// Big, obvious choices for the step-by-step flows.
export function ChoiceCards<T extends string>({
  value,
  onChange,
  options,
  columns = 2,
  label,
}: {
  value: T | null;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode; description?: ReactNode; icon?: IconType; tone?: Tone }[];
  columns?: 2 | 3 | 5;
  label?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx(
        "grid gap-3",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-3",
        columns === 5 && "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
      )}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cx(
              "flex min-h-16 items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3 text-left transition-colors",
              selected ? "border-brand bg-brand-soft" : "border-line hover:border-line-strong",
            )}
          >
            {option.icon && <IconTile icon={option.icon} tone={option.tone ?? "blue"} size="sm" />}
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold text-ink">{option.label}</span>
              {option.description && <span className="block text-sm text-ink-3">{option.description}</span>}
            </span>
            <span
              aria-hidden
              className={cx(
                "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                selected ? "border-brand bg-brand" : "border-line-strong bg-white",
              )}
            >
              {selected && <span className="size-2.5 rounded-full bg-white" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Stepper({
  value,
  onChange,
  max,
  label,
  size = "md",
}: {
  value: number;
  onChange: (value: number) => void;
  max?: number;
  label: string;
  size?: "sm" | "md";
}) {
  const t = useT();
  const clamp = (n: number) => Math.max(0, max === undefined ? n : Math.min(n, max));
  const button = size === "sm" ? "size-10" : "size-12";
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-line-strong bg-white p-1 shadow-xs">
      <button
        type="button"
        aria-label={`${t.common.less}: ${label}`}
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= 0}
        className={cx(
          "flex items-center justify-center rounded-full bg-gray-100 text-ink hover:bg-gray-200 active:bg-gray-300 disabled:bg-gray-50 disabled:text-gray-300",
          button,
        )}
      >
        <Minus className="size-5" strokeWidth={2.5} />
      </button>
      <input
        aria-label={label}
        inputMode="numeric"
        value={value === 0 ? "" : String(value)}
        placeholder="0"
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          onChange(clamp(digits === "" ? 0 : parseInt(digits, 10)));
        }}
        onFocus={(e) => e.target.select()}
        className={cx(
          "bg-transparent text-center font-bold text-ink tabular placeholder:text-gray-400 focus:outline-none",
          size === "sm" ? "w-12 text-lg" : "w-14 text-xl",
        )}
      />
      <button
        type="button"
        aria-label={`${t.common.more}: ${label}`}
        onClick={() => onChange(clamp(value + 1))}
        disabled={max !== undefined && value >= max}
        className={cx(
          "flex items-center justify-center rounded-full bg-brand text-white hover:bg-brand-strong active:bg-brand-strong disabled:bg-gray-100 disabled:text-gray-300",
          button,
        )}
      >
        <Plus className="size-5" strokeWidth={2.5} />
      </button>
    </div>
  );
}

// "Step 2 of 4" with a segmented progress bar.
export function StepHeader({ step, of, title }: { step: number; of: number; title: string }) {
  const t = useT();
  return (
    <div className="mb-6" data-tour="flow-steps">
      <div className="flex items-center justify-between gap-3">
        <p className="text-base font-semibold text-brand-strong">{t.common.stepOf(step, of)}</p>
      </div>
      <div className="mt-2 flex gap-2" aria-hidden>
        {Array.from({ length: of }, (_, i) => (
          <span key={i} className={cx("h-2 flex-1 rounded-full", i < step ? "bg-brand" : "bg-gray-200")} />
        ))}
      </div>
      <h1 className="mt-5 text-3xl font-bold tracking-tight text-ink">{title}</h1>
    </div>
  );
}

/* ---------- Dialogs ---------- */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const t = useT();
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-gray-900/40 sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(
          "flex w-full flex-col bg-white shadow-pop sm:max-h-[90dvh] sm:rounded-3xl",
          wide ? "sm:max-w-3xl" : "sm:max-w-xl",
        )}
      >
        <div
          className="flex items-start justify-between gap-4 border-b border-line px-6 py-5"
          style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}
        >
          <div className="min-w-0">
            <h2 id={titleId} className="text-xl font-bold text-ink">
              {title}
            </h2>
            {description && <p className="mt-1 text-base text-ink-3">{description}</p>}
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            <X className="size-5" /> {t.common.close}
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div
            className="flex flex-wrap justify-end gap-3 border-t border-line px-6 py-4"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function Money({ value, className }: { value: string; className?: string }) {
  return <span className={cx("whitespace-nowrap tabular", className)}>{value}</span>;
}
