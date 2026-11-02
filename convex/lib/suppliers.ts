import type { Doc } from "../_generated/dataModel";
import { daysBetween } from "./dates";

// Shared by the server and the screens, so the total on screen is the total saved.

export type SupplierKey = "coke" | "sanMiguel";

// Products without a supplier follow their category: beer is San Miguel,
// softdrinks and other (like Wilkins water) are Coke.
export function supplierOf(product: Pick<Doc<"products">, "supplier" | "category">) {
  return product.supplier ?? (product.category === "beer" ? "sanMiguel" : "coke");
}

// Full goods − empties = total. Full goods: full cases × cost per case.
// Empties: empty cases given back × what the supplier takes off for each.
export function computePurchase(items: { quantity: number; cost: number; emptiesReturned: number; emptyValue: number }[]) {
  const sum = (pick: (item: (typeof items)[number]) => number) => items.reduce((total, item) => total + pick(item), 0);
  const fullGoods = sum((item) => item.quantity * item.cost);
  const emptiesAmount = sum((item) => item.emptiesReturned * item.emptyValue);
  return {
    cases: sum((item) => item.quantity),
    empties: sum((item) => item.emptiesReturned),
    fullGoods,
    emptiesAmount,
    total: fullGoods - emptiesAmount,
  };
}

export const CHECK_WARN_DAYS = 3;

// Why a check that hasn't cleared needs attention, if it does.
export function checkWarning(
  check: Pick<Doc<"supplierChecks">, "status" | "checkDate" | "dueDate">,
  today: string,
): { kind: "afterDue" } | { kind: "overdue"; days: number } | { kind: "dueSoon"; days: number } | null {
  if (check.status !== "pending") return null;
  if (check.checkDate > check.dueDate) return { kind: "afterDue" };
  const daysLeft = daysBetween(today, check.dueDate);
  if (daysLeft < 0) return { kind: "overdue", days: -daysLeft };
  if (daysLeft <= CHECK_WARN_DAYS) return { kind: "dueSoon", days: daysLeft };
  return null;
}
