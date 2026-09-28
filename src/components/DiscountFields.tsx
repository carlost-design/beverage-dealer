import type { DiscountRule, DiscountType } from "../../convex/lib/money";
import { useT } from "../i18n";
import { parsePeso } from "../lib/format";
import { Field, Input, PesoInput, Select } from "./ui";

export type DiscountDraft = { type: DiscountType | "none"; value: string };

// undefined = no discount, null = the amount can't be read.
export function readDiscount(draft: DiscountDraft): DiscountRule | undefined | null {
  if (draft.type === "none" || draft.value.trim() === "") return undefined;
  if (draft.type === "percent") {
    const value = Number(draft.value);
    if (!Number.isFinite(value) || value <= 0 || value > 100) return null;
    return { type: "percent", value };
  }
  const value = parsePeso(draft.value);
  if (value === null) return null;
  return value === 0 ? undefined : { type: draft.type, value };
}

export function DiscountFields({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: DiscountDraft;
  onChange: (value: DiscountDraft) => void;
}) {
  const t = useT();
  return (
    <Field label={label} hint={hint} error={readDiscount(value) === null ? t.discount.checkAmount : undefined}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          value={value.type}
          onChange={(e) => onChange({ type: e.target.value as DiscountDraft["type"], value: value.value })}
          className="min-w-0 sm:flex-1"
        >
          <option value="none">{t.discount.none}</option>
          <option value="perCase">{t.discount.perCase}</option>
          <option value="percent">{t.discount.percent}</option>
          <option value="fixed">{t.discount.fixed}</option>
        </Select>
        {value.type === "percent" && (
          <div className="relative sm:w-36">
            <Input
              value={value.value}
              onChange={(e) => onChange({ ...value, value: e.target.value })}
              inputMode="decimal"
              className="pr-10 font-semibold tabular"
              aria-label={t.discount.percentLabel}
            />
            <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center font-semibold text-ink-3">%</span>
          </div>
        )}
        {(value.type === "fixed" || value.type === "perCase") && (
          <PesoInput value={value.value} onChange={(v) => onChange({ ...value, value: v })} className="sm:w-40" aria-label={t.discount.amountLabel} />
        )}
      </div>
    </Field>
  );
}
