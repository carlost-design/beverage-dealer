import { Beer, CupSoda, Package } from "lucide-react";
import { IconTile } from "./ui";

// Stands in for the reference's product photos: a tinted tile by product type.
export function ProductTile({ category, size = "md" }: { category: "softdrinks" | "beer" | "other"; size?: "sm" | "md" }) {
  if (category === "beer") return <IconTile icon={Beer} tone="amber" size={size} />;
  if (category === "softdrinks") return <IconTile icon={CupSoda} tone="blue" size={size} />;
  return <IconTile icon={Package} tone="gray" size={size} />;
}
