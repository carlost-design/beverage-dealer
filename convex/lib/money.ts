// Shared by the Convex functions and the React app. Money is in centavos.

export type DiscountType = "percent" | "fixed" | "perCase";
export type DiscountRule = { type: DiscountType; value: number };
export type PaymentStatus = "unpaid" | "partial" | "paid";

export function discountAmount(
  rule: DiscountRule | undefined,
  subtotal: number,
  cases: number,
): number {
  if (!rule || rule.value <= 0) return 0;
  const raw =
    rule.type === "percent"
      ? Math.round((subtotal * rule.value) / 100)
      : rule.type === "fixed"
        ? rule.value
        : rule.value * cases;
  return Math.min(Math.max(raw, 0), subtotal);
}

// What one order line costs after its per-case discount.
export function lineAmount(item: { price: number; quantity: number; discountPerCase?: number }): number {
  return Math.round((item.price - (item.discountPerCase ?? 0)) * item.quantity);
}

type Deposits = { depositCases?: number; refundCases?: number; depositPerCase?: number };

// Deposits minus refunds on an order. It is in the total but is not a sale.
export function depositNet(order: Deposits): number {
  return ((order.depositCases ?? 0) - (order.refundCases ?? 0)) * (order.depositPerCase ?? 0);
}

export function paymentStatusFor(total: number, paid: number): PaymentStatus {
  if (paid >= total) return "paid";
  return paid > 0 ? "partial" : "unpaid";
}

// Formats without Intl so the output is identical on the server and on
// every device.
export function formatPeso(centavos: number): string {
  const sign = centavos < 0 ? "-" : "";
  const abs = Math.abs(Math.round(centavos));
  const pesos = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const cents = (abs % 100).toString().padStart(2, "0");
  return `${sign}₱${pesos}.${cents}`;
}

export function describeDiscount(rule: DiscountRule): string {
  if (rule.type === "percent") return `${rule.value}% off`;
  if (rule.type === "fixed") return `${formatPeso(rule.value)} off`;
  return `${formatPeso(rule.value)} off per case`;
}
