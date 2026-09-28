---
name: Dealer Inventory
description: A beverage dealer's day, readable at arm's length by an elderly owner.
colors:
  canvas: "#f4f5f7"
  surface: "#ffffff"
  line: "#e5e7eb"
  line-strong: "#d1d5db"
  ink: "#111827"
  ink-2: "#374151"
  ink-3: "#4b5563"
  brand: "#2563eb"
  brand-strong: "#1d4ed8"
  brand-soft: "#eef3ff"
  late-text: "#b42318"
  late-soft: "#fef3f2"
  late-solid: "#dc2626"
  paid-text: "#146c43"
  paid-soft: "#e8f7ee"
  owed-text: "#93370d"
  owed-soft: "#fef3e2"
  chart-sales: "#2563eb"
  chart-received: "#98a2b3"
typography:
  display:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  figure:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  control: "12px"
  card: "16px"
  sheet: "24px"
  pill: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    height: "3rem"
    padding: "0 1.25rem"
  button-primary-hover:
    backgroundColor: "{colors.brand-strong}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "3rem"
  button-success:
    backgroundColor: "#059669"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    height: "3.5rem"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "1.25rem"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "3rem"
  chip-late:
    backgroundColor: "{colors.late-solid}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
  chip-paid:
    backgroundColor: "{colors.paid-soft}"
    textColor: "{colors.paid-text}"
    rounded: "{rounded.pill}"
  nav-item-active:
    backgroundColor: "{colors.brand-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
---

# Design System: Dealer Inventory

## Overview

The owner's reference was a modern light admin dashboard: white rounded cards on a soft gray canvas, a white sidebar with a pill for the active page, a search pill in the top bar, big bold numbers with small change chips, blue gradient charts and pill buttons. This system keeps that world and scales it for older eyes. The root font is 18px (20px and 22px with the Text size setting), every control is at least 48px, and contrast meets WCAG AA or better.

The app is for doing work, not browsing. Every screen has one obvious next action. The main jobs (new order, receive payment, delivery arrived, close the day) are step-by-step flows with a fixed Back / Next bar and a clear success screen at the end. Lateness is never subtle: the client's name turns red everywhere, late rows get a red wash, and a solid red chip gives the number of days.

The app has an English and a Filipino language setting. The business's own Tagalog status words (Bayad na, May balanse, Hindi pa bayad, utang) are the same in both.

## Colors

### Primary
- **Dealer Blue** (`#2563eb`) is for primary actions, the active page, focus rings and the sales line. **Deep Blue** (`#1d4ed8`) is its hover state and the text on blue tints. **Blue Wash** (`#eef3ff`) is the active nav pill, selected choice cards and the total bar.

### Neutral
- **Canvas** (`#f4f5f7`) is the app background. **Surface** (`#ffffff`) is for cards, the sidebar and the top bar.
- **Hairline** (`#e5e7eb`) is for card borders and dividers. **Strong Line** (`#d1d5db`) is for input and secondary button borders.
- **Ink** (`#111827`) is for text. **Ink 2** (`#374151`) is for labels. **Ink 3** (`#4b5563`) is for secondary text. Ink 3 is the lightest text color allowed, at 7.5:1 on white.

### Status (reserved, always with a word or icon)
- **Late:** `#b42318` text, `#fef3f2` row wash, `#dc2626` solid chip.
- **Paid:** `#146c43` on `#e8f7ee`.
- **Owed / partial:** `#93370d` on `#fef3e2`.

### Named Rules
**The Red Means Late Rule.** Red is only for money that is past due, stock that is missing (kulang) and destructive actions. Never use it for decoration or as a chart series.

## Typography

**Font:** Inter Variable, self-hosted, with `cv05` (tailed l) and `cv08` (serifed I) turned on so l, I and 1 can't be confused.

### Hierarchy
- **Display** (700, 1.875rem, -0.025em) is for page titles and step questions ("How many cases?").
- **Figure** (700, 2rem) is for stat card values. Big money values use proportional figures and round to whole pesos.
- **Title** (600, 1.125rem) is for card headings and client names in lists.
- **Body** (400, 1rem = 18px) is for everything else. Columns of numbers use `tabular-nums`.
- **Caption** (400, 0.875rem) is for secondary lines only, never for anything the owner has to act on.

## Layout

- On a laptop, a 17rem (288px) white sidebar sits next to a max-7xl content column. Below 1024px, phones and iPads get a sticky top bar and a bottom tab bar with a raised New order button.
- Step-by-step flows use a centered max-3xl column and hide the bottom tabs on small screens, so only their own Back / Next bar remains.
- Dashboard rows go 2 columns on phones and 4 on wide screens. Summary money rounds to whole pesos so values never overflow a card.

## Elevation & Depth

Cards use a hairline border plus a soft two-layer shadow (`0 1px 2px / 4%`, `0 4px 12px / 4%`). Popovers, dialogs and hovered task buttons use a stronger lift (`0 16px 40px / 14%`). Nothing uses a zero-blur shadow or glow.

## Shapes

Buttons, chips, search, segmented controls and steppers are all pills. Inputs use 12px corners, cards 16px, dialogs 24px.

## Components

### Buttons
- The primary button is Dealer Blue, the secondary is white with a strong border, and success is emerald (used only for Save order and Save payment). Heights are 3rem, or 3.5rem in flows.
- Every button has a text label. Icon-only buttons exist only where there is also an `aria-label`: the stepper +/−, date arrows, and the round top-bar buttons.

### Chips
- Status chips always carry a word, plus an icon for payment status.
- The solid red "Late N days" chip is the loudest element on any screen.

### Cards / Containers
- White, 16px corners, 20–24px padding.
- Stat cards: a title, a tinted icon tile in the corner, the big figure, then an optional chip and a caption.

### Inputs / Fields
- Labels always sit above the field (never placeholder-only). Hints and errors sit below at caption size.
- Money inputs have a ₱ prefix and use the decimal keypad.

### Navigation
- Sidebar items are 48px tall. The active one gets a blue-wash pill plus a 4px blue edge bar.
- Count badges: green for deliveries still to go, solid red for late clients.

### Stepper (signature)
A pill with a gray − and a solid blue + (48–54px round buttons) around a large bold number that can also be typed. It is used everywhere cases are counted.

### Task Buttons (signature)
Four large tiles on Home: New order (solid blue), Receive payment, Delivery arrived and Close the day. Each has a tinted icon tile, a 1.25rem label and an arrow.

## Do's and Don'ts

### Do:
- **Do** keep one primary action per screen and put step-by-step flows behind Back / Next.
- **Do** show every amount the owner acts on at full size. Round only summary figures.
- **Do** end every task with a plain success screen that has the next obvious actions (Print receipt, another order, Home).
- **Do** use the owner's words: kaha, utang, suki, Bayad na.

### Don't:
- **Don't** use red for anything but late, missing or destructive.
- **Don't** put information only in hover tooltips. Charts have a table view.
- **Don't** shrink body text below 1rem or controls below 48px, even on phones.
- **Don't** use icon-only controls without a visible or accessible label.
