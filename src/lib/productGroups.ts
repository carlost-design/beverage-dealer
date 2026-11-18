import type { Doc } from "../../convex/_generated/dataModel";

type Category = Doc<"products">["category"];
export type Section<P> = { key: string; title: string; products: P[] };

// Splits a list (already sorted by the server) into the sections shown on
// screen: one per product group in the owner's order, then products without a
// group. Before any group is made, sections follow the category, as before.
export function productSections<P extends Pick<Doc<"products">, "category" | "groupId">>(
  products: P[],
  groups: Pick<Doc<"productGroups">, "_id" | "name">[],
  labels: { category: (c: Category) => string; ungrouped: string },
): Section<P>[] {
  const sections: Section<P>[] =
    groups.length === 0
      ? (["softdrinks", "beer", "other"] as const).map((c) => ({
          key: c,
          title: labels.category(c),
          products: products.filter((p) => p.category === c),
        }))
      : [
          ...groups.map((g) => ({ key: g._id, title: g.name, products: products.filter((p) => p.groupId === g._id) })),
          {
            key: "none",
            title: labels.ungrouped,
            products: products.filter((p) => !p.groupId || !groups.some((g) => g._id === p.groupId)),
          },
        ];
  return sections.filter((s) => s.products.length > 0);
}
