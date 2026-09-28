// Display labels shared by the Convex functions and the React app.

export const METHOD_LABELS = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  bank: "Bank transfer",
  check: "Check",
} as const;

export type PaymentMethod = keyof typeof METHOD_LABELS;

export const CATEGORY_LABELS = {
  softdrinks: "Softdrinks",
  beer: "Beer",
  other: "Other",
} as const;

export type ProductCategory = keyof typeof CATEGORY_LABELS;

export function termsLabel(days: number): string {
  return days === 0 ? "Pay on delivery" : `${days} day${days === 1 ? "" : "s"}`;
}
