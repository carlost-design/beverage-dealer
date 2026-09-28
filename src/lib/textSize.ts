import { useCallback, useState } from "react";

export type TextSize = "normal" | "large" | "xl";

const KEY = "dealer.textSize";

export function readTextSize(): TextSize {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === "large" || saved === "xl" ? saved : "normal";
  } catch {
    return "normal";
  }
}

// Sets the root font size (see index.css). Saved per device: a phone and a
// laptop can use different sizes.
export function applyTextSize(size: TextSize) {
  if (size === "normal") delete document.documentElement.dataset.textSize;
  else document.documentElement.dataset.textSize = size;
  try {
    localStorage.setItem(KEY, size);
  } catch {
    // Private mode: the size still applies for this visit.
  }
}

export function useTextSize() {
  const [size, setSize] = useState<TextSize>(readTextSize);
  const change = useCallback((next: TextSize) => {
    applyTextSize(next);
    setSize(next);
  }, []);
  return [size, change] as const;
}
