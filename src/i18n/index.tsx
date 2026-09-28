import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "../../convex/_generated/api";
import type { DiscountRule } from "../../convex/lib/money";
import {
  formatDate,
  formatDateTime,
  formatDay,
  formatMoney,
  formatShortDate,
  formatTime,
  formatWeekday,
} from "../lib/format";
import { en, fil, type Strings } from "./strings";

export type Lang = "en" | "fil";

const KEY = "dealer.lang";

function storedLang(): Lang {
  try {
    return localStorage.getItem(KEY) === "fil" ? "fil" : "en";
  } catch {
    return "en";
  }
}

type LangState = { lang: Lang; t: Strings; setLocalLang: (lang: Lang) => void };

const LangContext = createContext<LangState>({ lang: "en", t: en, setLocalLang: () => {} });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(storedLang);
  const setLocalLang = useCallback((next: Lang) => {
    setLang(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Private mode: the language still applies for this visit.
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang === "fil" ? "fil" : "en";
  }, [lang]);
  const value = useMemo(() => ({ lang, t: lang === "fil" ? fil : en, setLocalLang }), [lang, setLocalLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useT() {
  return useContext(LangContext).t;
}

export function useLang() {
  return useContext(LangContext).lang;
}

// Changes the language on this device and, when signed in, on the account
// so the owner's other devices follow.
export function useSetLanguage() {
  const { setLocalLang } = useContext(LangContext);
  const save = useMutation(api.settings.setLanguage);
  return useCallback(
    (next: Lang, signedIn = true) => {
      setLocalLang(next);
      if (signedIn) void save({ language: next }).catch(() => {});
    },
    [save, setLocalLang],
  );
}

// Applies the language saved on the account after signing in.
export function LanguageSync() {
  const settings = useQuery(api.settings.get);
  const { lang, setLocalLang } = useContext(LangContext);
  const saved = settings?.language;
  useEffect(() => {
    if (saved && saved !== lang) setLocalLang(saved);
    // Only react to the saved value changing, not to local switches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);
  return null;
}

// Formatting that depends on the language.
export function useFmt() {
  const t = useT();
  const locale = t.locale;
  return useMemo(
    () => ({
      money: formatMoney,
      // Big summary numbers round to whole pesos so they stay readable.
      moneyWhole: (centavos: number) => formatMoney(Math.round(centavos / 100) * 100),
      date: (d: string) => formatDate(d, locale),
      shortDate: (d: string) => formatShortDate(d, locale),
      day: (d: string) => formatDay(d, locale),
      weekday: (d: string) => formatWeekday(d, locale),
      time: (ts: number) => formatTime(ts, locale),
      dateTime: (ts: number) => formatDateTime(ts, locale),
      terms: (days: number) => (days === 0 ? t.terms.payOnDelivery : t.terms.days(days)),
      discount: (rule: DiscountRule) =>
        rule.type === "percent"
          ? t.discount.describePercent(rule.value)
          : rule.type === "fixed"
            ? t.discount.describeFixed(formatMoney(rule.value))
            : t.discount.describePerCase(formatMoney(rule.value)),
      method: (m: keyof Strings["methods"]) => t.methods[m],
      category: (c: keyof Strings["categories"]) => t.categories[c],
    }),
    [locale, t],
  );
}

// Server errors carry both languages; show the one in use.
export function useErrorMessage() {
  const t = useT();
  const lang = useLang();
  return useCallback(
    (error: unknown) => {
      if (error instanceof ConvexError) {
        const data = error.data as unknown;
        if (typeof data === "string") return data;
        if (data && typeof data === "object") {
          const record = data as Record<string, unknown>;
          const text = record[lang] ?? record.en ?? record.message;
          if (typeof text === "string") return text;
        }
      }
      return t.common.somethingWrong;
    },
    [lang, t],
  );
}
