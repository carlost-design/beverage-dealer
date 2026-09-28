import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useFmt, useT } from "../i18n";
import { addDays } from "../lib/useToday";
import { Button } from "./ui";

// Reference-style date pill with big previous/next buttons.
export function DateNav({
  date,
  today,
  onChange,
}: {
  date: string;
  today: string;
  onChange: (date: string) => void;
}) {
  const t = useT();
  const fmt = useFmt();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" aria-label={t.common.previousDay} onClick={() => onChange(addDays(date, -1))} className="w-12 px-0">
        <ChevronLeft className="size-6" />
      </Button>
      <label className="relative inline-flex h-12 items-center gap-2 rounded-full border border-line-strong bg-white pr-5 pl-4 text-base font-semibold text-ink shadow-xs">
        <CalendarDays className="size-5 text-ink-3" aria-hidden />
        <span>{date === today ? `${t.common.today} · ${fmt.shortDate(date)}` : fmt.date(date)}</span>
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          aria-label={t.common.date}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
      <Button
        variant="secondary"
        aria-label={t.common.nextDay}
        disabled={date >= today}
        onClick={() => onChange(addDays(date, 1))}
        className="w-12 px-0"
      >
        <ChevronRight className="size-6" />
      </Button>
      {date !== today && (
        <Button variant="soft" onClick={() => onChange(today)}>
          {t.common.backToToday}
        </Button>
      )}
    </div>
  );
}
