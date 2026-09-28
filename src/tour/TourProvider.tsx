import { ArrowLeft, ArrowRight, CheckCircle2, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router";
import { Button } from "../components/ui";
import { cx } from "../lib/format";
import { TOURS, type TourKey, type TourStep } from "./tours";

// The on-screen walkthrough. Each page says which tour belongs to it with
// useTourPage("..."); the "Gabayan ako" button starts that tour. A step points
// at elements marked data-tour="..." and dims everything else.

type TourContextValue = {
  pageTour: TourKey | null;
  activeTour: TourKey | null;
  start: (key: TourKey, path?: string) => void;
  stop: () => void;
  setPageTour: (key: TourKey | null) => void;
};

const TourContext = createContext<TourContextValue | null>(null);

const WELCOME_KEY = "dealer.tourWelcomeDone";

export function readWelcomeDone() {
  try {
    return localStorage.getItem(WELCOME_KEY) === "1";
  } catch {
    return false;
  }
}

export function markWelcomeDone() {
  try {
    localStorage.setItem(WELCOME_KEY, "1");
  } catch {
    // Private mode: the welcome card just shows again next time.
  }
}

export function TourProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [pageTour, setPageTourState] = useState<TourKey | null>(null);
  const [activeTour, setActiveTour] = useState<TourKey | null>(null);
  // A tour asked for from another page starts once that page has loaded.
  const [pending, setPending] = useState<TourKey | null>(null);

  const setPageTour = useCallback((key: TourKey | null) => setPageTourState(key), []);

  // A tour belongs to one screen, so leaving the screen ends it.
  useEffect(() => setActiveTour(null), [pathname]);

  useEffect(() => {
    if (!pending) return;
    if (pageTour === pending) {
      setActiveTour(pending);
      setPending(null);
      return;
    }
    // The screen may not have that tour right now (e.g. the day is already
    // closed); forget the request rather than starting it later by surprise.
    const id = window.setTimeout(() => setPending(null), 4000);
    return () => window.clearTimeout(id);
  }, [pending, pageTour]);

  const start = useCallback(
    (key: TourKey, path?: string) => {
      if (path) {
        setPending(key);
        navigate(path);
      } else {
        setActiveTour(key);
      }
    },
    [navigate],
  );

  const stop = useCallback(() => {
    if (activeTour === "home") markWelcomeDone();
    setActiveTour(null);
  }, [activeTour]);

  const value = useMemo(
    () => ({ pageTour, activeTour, start, stop, setPageTour }),
    [pageTour, activeTour, start, stop, setPageTour],
  );

  return (
    <TourContext.Provider value={value}>
      {children}
      {activeTour && <TourOverlay key={activeTour} steps={TOURS[activeTour].steps} onClose={stop} />}
    </TourContext.Provider>
  );
}

export function useTour() {
  const value = useContext(TourContext);
  if (!value) throw new Error("useTour must be used inside TourProvider");
  return value;
}

// Tells the "Gabayan ako" button which tour this page has.
export function useTourPage(key: TourKey | null) {
  const { setPageTour } = useTour();
  useEffect(() => {
    setPageTour(key);
    return () => setPageTour(null);
  }, [key, setPageTour]);
}

/* ---------- Overlay ---------- */

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 8;
const GAP = 14;
const MARGIN = 12;
// Room for the sticky top bar, so a target is never hidden under it.
const TOP_INSET = 84;

function isVisible(el: Element) {
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  const style = getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none";
}

function findTarget(step: TourStep): Element | null {
  if (!step.target) return null;
  const names = Array.isArray(step.target) ? step.target : [step.target];
  for (const name of names) {
    for (const el of document.querySelectorAll(`[data-tour="${name}"]`)) {
      if (isVisible(el)) return el;
    }
  }
  return null;
}

// Fixed elements (the bottom bar, the sidebar) do not move when the page scrolls.
function isFixed(el: Element) {
  for (let node: Element | null = el; node; node = node.parentElement) {
    const position = getComputedStyle(node).position;
    if (position === "fixed" || position === "sticky") return true;
  }
  return false;
}

function TourOverlay({ steps: allSteps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  // Steps whose target is not on this screen (e.g. the sidebar on a phone) are
  // dropped. The page may still be loading, so wait a moment for its parts.
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  useEffect(() => {
    let tries = 0;
    let id = 0;
    const check = () => {
      const found = allSteps.filter((step) => !step.target || findTarget(step));
      const ready = found.some((step) => step.target) || !allSteps.some((step) => step.target);
      if (ready || ++tries >= 25) {
        window.clearInterval(id);
        if (found.length === 0) onClose();
        else setSteps(found);
      }
    };
    id = window.setInterval(check, 100);
    check();
    return () => window.clearInterval(id);
  }, [allSteps, onClose]);

  if (!steps) return null;
  return <TourSteps steps={steps} onClose={onClose} />;
}

function TourSteps({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardHeight, setCardHeight] = useState(0);
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const cardRef = useRef<HTMLDivElement>(null);
  const step = steps[index]!;
  const last = index === steps.length - 1;

  // Find the target and keep the spotlight on it while the page moves.
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
      const el = findTarget(step);
      if (!el) return setRect(null);
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    const onChange = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    // Smooth scrolling and late-loading parts move the target for a moment.
    const settle = window.setInterval(measure, 120);
    const stopSettle = window.setTimeout(() => window.clearInterval(settle), 1500);
    window.addEventListener("scroll", onChange, true);
    window.addEventListener("resize", onChange);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(settle);
      window.clearTimeout(stopSettle);
      window.removeEventListener("scroll", onChange, true);
      window.removeEventListener("resize", onChange);
    };
  }, [step]);

  // Once the card's size is known, scroll so the target and the card both fit.
  const scrolledFor = useRef<TourStep | null>(null);
  useEffect(() => {
    if (!rect || !cardHeight || scrolledFor.current === step) return;
    scrolledFor.current = step;
    const el = findTarget(step);
    if (!el || isFixed(el) || !cardRef.current) return;
    // Measure fresh: the state may still hold the previous step's position.
    const r = el.getBoundingClientRect();
    const card = cardRef.current.offsetHeight;
    const top = r.top - PAD;
    const bottom = r.bottom + PAD;
    const h = window.innerHeight;
    const fitsBelow = top >= TOP_INSET && bottom + GAP + card <= h - MARGIN;
    const fitsAbove = top - GAP - card >= TOP_INSET && bottom <= h - MARGIN;
    if (fitsBelow || fitsAbove) return;
    // Put the target just under the top bar with the card beneath it. A target
    // too tall for that still starts at the top, so its beginning is in view.
    window.scrollBy({ top: top - TOP_INSET, behavior: "smooth" });
  }, [rect, cardHeight, step]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardHeight(cardRef.current.offsetHeight);
  }, [step, rect, viewport.w]);

  useEffect(() => {
    cardRef.current?.querySelector<HTMLButtonElement>("[data-tour-next]")?.focus({ preventScroll: true });
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, steps.length - 1));
      else if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, steps.length]);

  const phone = viewport.w < 640;
  const hole = rect && {
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  };

  // Where the card goes: under the target if it fits, else above, else beside
  // it, else docked at the edge of the screen.
  let cardStyle: React.CSSProperties;
  if (!hole) {
    cardStyle = { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  } else {
    const width = phone ? viewport.w - MARGIN * 2 : Math.min(440, viewport.w - MARGIN * 2);
    const left = phone ? MARGIN : Math.min(Math.max(hole.left + hole.width / 2 - width / 2, MARGIN), viewport.w - width - MARGIN);
    const below = hole.top + hole.height + GAP;
    const above = hole.top - GAP - cardHeight;
    const right = hole.left + hole.width + GAP;
    const sideTop = Math.min(Math.max(hole.top, MARGIN), viewport.h - cardHeight - MARGIN);
    if (below + cardHeight <= viewport.h - MARGIN) cardStyle = { top: below, left, width };
    else if (above >= MARGIN) cardStyle = { top: above, left, width };
    else if (!phone && right + width <= viewport.w - MARGIN) cardStyle = { top: sideTop, left: right, width };
    else if (!phone && hole.left - GAP - width >= MARGIN) cardStyle = { top: sideTop, left: hole.left - GAP - width, width };
    else {
      // Docked: on a wide screen, slide to whichever side covers less of the
      // target. Tall targets were scrolled to the top, so dock at the bottom.
      let dockLeft = left;
      if (!phone) {
        const covered = (x: number) => Math.max(0, Math.min(x + width, hole.left + hole.width) - Math.max(x, hole.left));
        const edges = [MARGIN, viewport.w - width - MARGIN];
        dockLeft = edges.reduce((best, x) => (covered(x) < covered(best) ? x : best), left);
      }
      cardStyle = hole.top > viewport.h / 2 ? { top: MARGIN, left: dockLeft, width } : { bottom: MARGIN, left: dockLeft, width };
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[70]" lang="fil">
      {/* Catches clicks so nothing behind the tour is pressed by mistake. */}
      <div className="absolute inset-0" aria-hidden onClick={(e) => e.stopPropagation()} />
      {hole ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-2xl ring-4 ring-white transition-all duration-300 ease-out"
          style={{ ...hole, boxShadow: "0 0 0 9999px rgba(17, 24, 39, 0.66)" }}
        >
          <span className="absolute -inset-2 animate-pulse rounded-3xl ring-4 ring-[#60A5FA]" />
        </div>
      ) : (
        <div aria-hidden className="absolute inset-0 bg-gray-900/66" />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className={cx(
          "absolute rounded-3xl bg-white p-4 shadow-pop transition-[top,left,bottom] duration-300 ease-out sm:p-6",
          !hole && "w-[min(32rem,calc(100vw-1.5rem))]",
        )}
        style={cardStyle}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-base font-semibold text-brand-strong">
            Hakbang {index + 1} sa {steps.length}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="-mt-2 -mr-2 flex h-11 items-center gap-1 rounded-full pr-3 pl-2 text-base font-semibold text-ink-3 hover:bg-gray-100 hover:text-ink"
          >
            <X className="size-5" aria-hidden /> Isara
          </button>
        </div>
        <div className="mt-2 flex gap-1.5" aria-hidden>
          {steps.map((_, i) => (
            <span key={i} className={cx("h-1.5 flex-1 rounded-full", i <= index ? "bg-brand" : "bg-gray-200")} />
          ))}
        </div>
        <h2 id="tour-title" className="mt-3 text-xl leading-tight font-bold tracking-tight text-ink sm:mt-4 sm:text-2xl">
          {step.title}
        </h2>
        <div id="tour-body" aria-live="polite" className="mt-1.5 text-lg leading-snug text-ink-2 sm:mt-2 sm:leading-relaxed">
          {step.body}
        </div>
        <div className="mt-4 flex items-center gap-3 sm:mt-5">
          {index > 0 && (
            <Button variant="secondary" size="lg" onClick={() => setIndex(index - 1)} aria-label="Bumalik">
              <ArrowLeft className="size-6" aria-hidden /> <span className="hidden sm:inline">Bumalik</span>
            </Button>
          )}
          <Button
            data-tour-next
            size="lg"
            variant={last ? "success" : "primary"}
            className="ml-auto"
            onClick={() => (last ? onClose() : setIndex(index + 1))}
          >
            {last ? (
              <>
                <CheckCircle2 className="size-6" aria-hidden /> Tapos na
              </>
            ) : (
              <>
                Susunod <ArrowRight className="size-6" aria-hidden />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
