import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useFmt, useT } from "../i18n";
import { cx } from "../lib/format";
import { addDays } from "../lib/useToday";

// Colors from the reference: blue for the main series, gray dashes for the
// comparison. Validated as a pair for color-blind separation.
const BLUE = "#2563EB";
const GRAY = "#98A2B3";

function niceStep(max: number, ticks: number) {
  const raw = max / ticks;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = [1, 2, 2.5, 5, 10].find((m) => m * power >= raw) ?? 10;
  return unit * power;
}

export function compactPeso(centavos: number) {
  const pesos = centavos / 100;
  if (pesos >= 1_000_000) return `₱${(pesos / 1_000_000).toFixed(pesos % 1_000_000 === 0 ? 0 : 1)}M`;
  if (pesos >= 1_000) return `₱${(pesos / 1_000).toFixed(pesos % 1_000 === 0 ? 0 : 1)}k`;
  return `₱${Math.round(pesos)}`;
}

function useWidth(min = 280) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(min, entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [min]);
  return [ref, width] as const;
}

type Point = { date: string; sales: number; collected: number };

// Sales (solid blue with a soft fill) against payments received (gray dashes).
export function TrendChart({ data }: { data: Point[] }) {
  const t = useT();
  const fmt = useFmt();
  const gradientId = useId();
  const [ref, width] = useWidth();
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const series = [
    { key: "sales" as const, label: t.reports.sales },
    { key: "collected" as const, label: t.reports.received },
  ];

  const height = 240;
  const pad = { top: 16, right: 12, bottom: 34, left: 58 };
  const { yMax, ticks } = useMemo(() => {
    const max = Math.max(1, ...data.flatMap((d) => [d.sales, d.collected]));
    const step = niceStep(max, 3);
    const top = Math.ceil(max / step) * step;
    return { yMax: top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step) };
  }, [data]);
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const x = (i: number) => pad.left + (data.length <= 1 ? 0 : (i / (data.length - 1)) * plotW);
  const y = (v: number) => pad.top + plotH - (v / yMax) * plotH;
  const line = (key: "sales" | "collected") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join("");
  const area = `${line("sales")}L${x(data.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
  const every = width < 520 ? 10 : 7;

  function pointAt(event: PointerEvent<SVGRectElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    setActive(Math.min(data.length - 1, Math.max(0, Math.round(ratio * (data.length - 1)))));
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") setActive((i) => Math.max(0, (i ?? data.length) - 1));
    else if (event.key === "ArrowRight") setActive((i) => Math.min(data.length - 1, (i ?? -1) + 1));
    else if (event.key === "Escape") setActive(null);
    else return;
    event.preventDefault();
  }

  const point = active === null ? null : data[active];
  const tipLeft = active === null ? 0 : Math.min(Math.max(x(active) + 12, 0), width - 230);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-5 text-base text-ink-2" aria-hidden>
          <span className="inline-flex items-center gap-2">
            <span className="h-[3px] w-5 rounded-full" style={{ backgroundColor: BLUE }} /> {series[0].label}
          </span>
          <span className="inline-flex items-center gap-2">
            <svg width="20" height="4" aria-hidden>
              <line x1="0" y1="2" x2="20" y2="2" stroke={GRAY} strokeWidth="3" strokeDasharray="5 4" strokeLinecap="round" />
            </svg>
            {series[1].label}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="rounded-full px-3 py-1.5 text-base font-semibold text-brand-strong hover:bg-brand-soft"
        >
          {showTable ? t.reports.showChart : t.reports.showTable}
        </button>
      </div>

      {showTable ? (
        <div className="max-h-96 overflow-auto rounded-xl border border-line">
          <table className="w-full text-base">
            <thead className="sticky top-0 bg-gray-50 text-left text-sm text-ink-3">
              <tr>
                <th className="px-4 py-2.5 font-semibold">{t.common.date}</th>
                <th className="px-4 py-2.5 text-right font-semibold">{series[0].label}</th>
                <th className="px-4 py-2.5 text-right font-semibold">{series[1].label}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular">
              {[...data].reverse().map((d) => (
                <tr key={d.date}>
                  <td className="px-4 py-2 text-ink-2">{fmt.shortDate(d.date)}</td>
                  <td className="px-4 py-2 text-right font-semibold">{fmt.money(d.sales)}</td>
                  <td className="px-4 py-2 text-right">{fmt.money(d.collected)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          ref={ref}
          className="relative rounded-xl focus-visible:outline-3 focus-visible:outline-brand"
          tabIndex={0}
          role="img"
          aria-label={t.reports.chartLabel(data.length)}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
        >
          <svg width={width} height={height} className="block overflow-visible">
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={BLUE} stopOpacity="0.22" />
                <stop offset="100%" stopColor={BLUE} stopOpacity="0" />
              </linearGradient>
            </defs>
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke="#E5E7EB"
                  strokeDasharray={tick === 0 ? undefined : "4 5"}
                />
                <text x={pad.left - 10} y={y(tick)} dy="0.35em" textAnchor="end" className="fill-ink-3 tabular" style={{ fontSize: "0.8rem" }}>
                  {compactPeso(tick)}
                </text>
              </g>
            ))}
            {data.map((d, i) =>
              i % every === (data.length - 1) % every ? (
                <text
                  key={d.date}
                  x={x(i)}
                  y={height - 8}
                  textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
                  className="fill-ink-3"
                  style={{ fontSize: "0.8rem" }}
                >
                  {fmt.shortDate(d.date)}
                </text>
              ) : null,
            )}
            <path d={area} fill={`url(#${gradientId})`} />
            <path d={line("collected")} fill="none" stroke={GRAY} strokeWidth={2} strokeDasharray="6 5" strokeLinecap="round" />
            <path d={line("sales")} fill="none" stroke={BLUE} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            {active !== null && (
              <line x1={x(active)} x2={x(active)} y1={pad.top} y2={pad.top + plotH} stroke="#98A2B3" strokeDasharray="3 4" />
            )}
            {active !== null &&
              series.map((s) => (
                <circle key={s.key} cx={x(active)} cy={y(data[active][s.key])} r={5} fill={s.key === "sales" ? BLUE : GRAY} stroke="#fff" strokeWidth={2} />
              ))}
            <rect
              x={pad.left}
              y={pad.top}
              width={Math.max(plotW, 0)}
              height={plotH}
              fill="transparent"
              onPointerMove={pointAt}
              onPointerDown={pointAt}
              onPointerLeave={() => setActive(null)}
            />
          </svg>
          {point && (
            <div
              className="pointer-events-none absolute top-2 w-56 rounded-xl border border-line bg-white px-4 py-3 shadow-pop"
              style={{ left: tipLeft }}
            >
              <p className="text-sm font-semibold text-ink-2">{fmt.date(point.date)}</p>
              {series.map((s) => (
                <p key={s.key} className="mt-1 flex items-center gap-2 text-base">
                  <span
                    className="h-[3px] w-4 shrink-0 rounded-full"
                    style={{ backgroundColor: s.key === "sales" ? BLUE : GRAY }}
                  />
                  <span className="font-bold text-ink tabular">{fmt.money(point[s.key])}</span>
                  <span className="text-sm text-ink-3">{s.label}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Average sales per weekday; the busiest day stands out in blue.
export function WeekdayBars({ data }: { data: { day: number; average: number }[] }) {
  const t = useT();
  const fmt = useFmt();
  const [ref, width] = useWidth(240);
  const height = 220;
  const max = Math.max(1, ...data.map((d) => d.average));
  const best = data.reduce((a, b) => (b.average > a.average ? b : a), data[0]);
  const slot = width / data.length;
  const barW = Math.min(44, slot * 0.62);
  const top = 30;
  const bottom = 30;
  const plotH = height - top - bottom;
  // Weekday names from a known Sunday (2026-09-27), in the current language.
  const weekday = (day: number) => fmt.weekday(addDays("2026-09-27", day));

  return (
    <div ref={ref}>
      <svg width={width} height={height} role="img" aria-label={t.reports.busiestDays} className="block overflow-visible">
        {data.map((d, i) => {
          const h = Math.max(10, (d.average / max) * plotH);
          const xPos = i * slot + (slot - barW) / 2;
          const isBest = d.day === best.day && d.average > 0;
          return (
            <g key={d.day}>
              <title>{`${weekday(d.day)}: ${fmt.money(d.average)}`}</title>
              <rect x={xPos} y={top + plotH - h} width={barW} height={h} rx={barW / 2.6} fill={isBest ? BLUE : "#EEF0F3"} />
              {isBest && (
                <text x={xPos + barW / 2} y={top + plotH - h - 10} textAnchor="middle" className="fill-ink font-bold" style={{ fontSize: "0.85rem" }}>
                  {compactPeso(d.average)}
                </text>
              )}
              <text
                x={xPos + barW / 2}
                y={height - 6}
                textAnchor="middle"
                className={cx(isBest ? "fill-brand-strong font-bold" : "fill-ink-3")}
                style={{ fontSize: "0.85rem" }}
              >
                {weekday(d.day)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Semicircle of ticks, like the reference's "Repeat Customer Rate" gauge.
export function TickGauge({ percent, label, caption }: { percent: number; label: string; caption?: string }) {
  const ticks = 34;
  const filled = Math.round((Math.max(0, Math.min(100, percent)) / 100) * ticks);
  const cx0 = 150;
  const cy0 = 150;
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 300 170" className="w-full max-w-[20rem]" role="img" aria-label={`${label}: ${Math.round(percent)}%`}>
        {Array.from({ length: ticks }, (_, i) => {
          const angle = Math.PI - (i / (ticks - 1)) * Math.PI;
          const inner = 104;
          const outer = 136;
          return (
            <line
              key={i}
              x1={cx0 + inner * Math.cos(angle)}
              y1={cy0 - inner * Math.sin(angle)}
              x2={cx0 + outer * Math.cos(angle)}
              y2={cy0 - outer * Math.sin(angle)}
              stroke={i < filled ? "#22C55E" : "#E5E7EB"}
              strokeWidth={7}
              strokeLinecap="round"
            />
          );
        })}
        <text x={cx0} y={cy0 - 22} textAnchor="middle" className="fill-ink font-bold" style={{ fontSize: "2.6rem" }}>
          {Math.round(percent)}%
        </text>
        {caption && (
          <text x={cx0} y={cy0 + 8} textAnchor="middle" className="fill-ink-3" style={{ fontSize: "0.95rem" }}>
            {caption}
          </text>
        )}
      </svg>
    </div>
  );
}
