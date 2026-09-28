import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { Languages, LogOut, Printer, Type } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { usePrint } from "../components/print";
import { TestSlip } from "../components/receipts";
import { Button, Card, CardHeader, ChoiceCards, Field, IconTile, Input, PageHeader, PageLoading, Segmented, Textarea } from "../components/ui";
import { useErrorMessage, useFmt, useLang, useSetLanguage, useT, type Lang } from "../i18n";
import { useTextSize, type TextSize } from "../lib/textSize";
import { useTourPage } from "../tour/TourProvider";

export default function Settings() {
  useTourPage("settings");
  const t = useT();
  const settings = useQuery(api.settings.get);
  if (!settings) return <PageLoading />;
  return (
    <>
      <PageHeader title={t.settings.title} />
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="space-y-5">
          <LanguageCard />
          <TextSizeCard />
          <Account />
        </div>
        <div className="space-y-5">
          <BusinessForm key={settings._id ?? "default"} settings={settings} />
          <ActivityLog />
        </div>
      </div>
    </>
  );
}

function LanguageCard() {
  const t = useT();
  const lang = useLang();
  const setLanguage = useSetLanguage();
  return (
    <Card className="p-5 sm:p-6" data-tour="settings-language">
      <div className="mb-4 flex items-center gap-3">
        <IconTile icon={Languages} tone="blue" />
        <div>
          <h2 className="text-xl font-bold text-ink">{t.settings.language}</h2>
          <p className="text-base text-ink-3">{t.settings.languageHint}</p>
        </div>
      </div>
      <ChoiceCards<Lang>
        label={t.settings.language}
        value={lang}
        onChange={(value) => setLanguage(value)}
        options={[
          { value: "en", label: "English" },
          { value: "fil", label: "Filipino" },
        ]}
      />
    </Card>
  );
}

function TextSizeCard() {
  const t = useT();
  const [size, setSize] = useTextSize();
  return (
    <Card className="p-5 sm:p-6" data-tour="settings-textsize">
      <div className="mb-4 flex items-center gap-3">
        <IconTile icon={Type} tone="violet" />
        <div>
          <h2 className="text-xl font-bold text-ink">{t.settings.textSize}</h2>
          <p className="text-base text-ink-3">{t.settings.textSizeHint}</p>
        </div>
      </div>
      <ChoiceCards<TextSize>
        label={t.settings.textSize}
        value={size}
        onChange={setSize}
        columns={3}
        options={[
          { value: "normal", label: <span className="text-lg">Aa · {t.settings.sizeNormal}</span> },
          { value: "large", label: <span className="text-xl">Aa · {t.settings.sizeLarge}</span> },
          { value: "xl", label: <span className="text-2xl">Aa · {t.settings.sizeXL}</span> },
        ]}
      />
      <p className="mt-4 rounded-xl bg-canvas px-4 py-3 text-lg text-ink">{t.settings.preview}</p>
    </Card>
  );
}

type SettingsData = NonNullable<ReturnType<typeof useSettingsQuery>>;
function useSettingsQuery() {
  return useQuery(api.settings.get);
}

function BusinessForm({ settings }: { settings: SettingsData }) {
  const t = useT();
  const errorMessage = useErrorMessage();
  const update = useMutation(api.settings.update);
  const print = usePrint();
  const [businessName, setBusinessName] = useState(settings.hasBusinessName ? settings.businessName : "");
  const [address, setAddress] = useState(settings.address ?? "");
  const [phone, setPhone] = useState(settings.phone ?? "");
  const [footer, setFooter] = useState(settings.receiptFooter ?? "");
  const [paperWidth, setPaperWidth] = useState(settings.paperWidth);
  const [copies, setCopies] = useState(String(settings.receiptCopies));
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await update({ businessName, address, phone, receiptFooter: footer, paperWidth, receiptCopies: Number(copies) });
      toast.success(t.settings.saved);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function testPrint() {
    print(
      <TestSlip
        settings={{
          businessName: businessName || t.settings.yourStoreName,
          address,
          phone,
          receiptFooter: footer,
          paperWidth,
          receiptCopies: 1,
        }}
      />,
    );
  }

  return (
    <Card data-tour="settings-business">
      <CardHeader title={t.settings.business} description={t.settings.businessHint} />
      <form onSubmit={handleSubmit} className="space-y-5 px-5 pb-6 sm:px-6">
        <Field label={t.settings.businessName}>
          <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder={t.settings.businessNamePlaceholder} required />
        </Field>
        <Field label={t.settings.address} hint={t.common.optional}>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field label={t.settings.phone} hint={t.common.optional}>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t.settings.paper}>
            <Segmented
              value={paperWidth}
              onChange={setPaperWidth}
              options={[
                { value: "58mm", label: "58 mm" },
                { value: "80mm", label: "80 mm" },
              ]}
            />
          </Field>
          <Field label={t.settings.copies} hint={t.settings.copiesHint}>
            <Segmented
              value={copies}
              onChange={setCopies}
              options={[
                { value: "1", label: t.settings.oneCopy },
                { value: "2", label: t.settings.twoCopies },
              ]}
            />
          </Field>
        </div>
        <Field label={t.settings.footer} hint={t.settings.footerHint}>
          <Textarea value={footer} onChange={(e) => setFooter(e.target.value)} rows={3} />
        </Field>
        <p className="rounded-xl bg-canvas px-4 py-3 text-base text-ink-2">{t.settings.printerHelp}</p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Button variant="secondary" size="lg" onClick={testPrint}>
            <Printer className="size-6" /> {t.settings.testPrint}
          </Button>
          <Button type="submit" size="lg" loading={saving}>
            {t.settings.save}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Account() {
  const t = useT();
  const me = useQuery(api.users.me);
  const { signOut } = useAuthActions();
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
      <div>
        <p className="text-base text-ink-3">{t.settings.signedInAs}</p>
        <p className="text-lg font-semibold text-ink">{me?.email}</p>
      </div>
      <Button variant="secondary" size="lg" onClick={() => void signOut()}>
        <LogOut className="size-6" /> {t.nav.signOut}
      </Button>
    </Card>
  );
}

function ActivityLog() {
  const t = useT();
  const fmt = useFmt();
  const { results, status, loadMore } = usePaginatedQuery(api.users.activityLog, {}, { initialNumItems: 15 });
  return (
    <Card data-tour="settings-activity">
      <CardHeader title={t.settings.activity} description={t.settings.activityHint} />
      {status === "LoadingFirstPage" ? (
        <p className="px-6 pb-6 text-base text-ink-3">…</p>
      ) : results.length === 0 ? (
        <p className="px-6 pb-6 text-base text-ink-3">{t.settings.nothing}</p>
      ) : (
        <ul className="divide-y divide-line px-5 sm:px-6">
          {results.map((entry) => (
            <li key={entry._id} className="py-3">
              <div className="flex flex-wrap justify-between gap-x-3">
                <span className="text-base font-semibold text-ink">{t.activityActions[entry.action] ?? entry.action}</span>
                <span className="text-sm text-ink-3">{fmt.dateTime(entry._creationTime)}</span>
              </div>
              <p className="text-base text-ink-2">{entry.details}</p>
            </li>
          ))}
        </ul>
      )}
      {status === "CanLoadMore" && (
        <div className="border-t border-line p-3 text-center">
          <Button variant="ghost" onClick={() => loadMore(20)}>
            {t.common.showMore}
          </Button>
        </div>
      )}
    </Card>
  );
}
