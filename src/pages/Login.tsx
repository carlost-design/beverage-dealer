import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { Eye, EyeOff } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";
import { LogoMark } from "../components/Logo";
import { Alert, Button, Field, Input, PageLoading, Segmented } from "../components/ui";
import { useLang, useSetLanguage, useT, type Lang } from "../i18n";

export default function Login() {
  const t = useT();
  const lang = useLang();
  const setLanguage = useSetLanguage();
  const hasOwner = useQuery(api.users.hasOwner);
  const { signIn } = useAuthActions();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (hasOwner === undefined) {
    return (
      <div className="p-8">
        <PageLoading />
      </div>
    );
  }
  const signingUp = !hasOwner;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    if (signingUp) {
      const password = String(form.get("password"));
      if (password.length < 8) return setError(t.login.tooShort);
      if (password !== form.get("confirm")) return setError(t.login.mismatch);
      form.delete("confirm");
    }
    form.set("flow", signingUp ? "signUp" : "signIn");
    setSubmitting(true);
    try {
      await signIn("password", form);
    } catch {
      setError(signingUp ? t.login.createFailed : t.login.wrong);
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Segmented<Lang>
            label="Language / Wika"
            value={lang}
            onChange={(value) => setLanguage(value, false)}
            options={[
              { value: "en", label: "English" },
              { value: "fil", label: "Filipino" },
            ]}
          />
        </div>
        <div className="rounded-3xl border border-line bg-white p-8 shadow-card">
          <div className="mb-7 flex flex-col items-center text-center">
            <LogoMark className="size-16" />
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink">
              {signingUp ? t.login.setupTitle : t.login.welcome}
            </h1>
            <p className="mt-2 text-base text-ink-3">{signingUp ? t.login.setupHint : t.login.welcomeHint}</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <Field label={t.login.email}>
              <Input name="email" type="email" autoComplete="email" required autoFocus />
            </Field>
            <Field label={t.login.password} hint={signingUp ? t.login.passwordHint : undefined}>
              <div className="relative">
                <Input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={signingUp ? "new-password" : "current-password"}
                  required
                  className="pr-14"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={t.login.showPassword}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-1 my-1 flex w-12 items-center justify-center rounded-lg text-ink-3 hover:bg-gray-100"
                >
                  {showPassword ? <EyeOff className="size-6" /> : <Eye className="size-6" />}
                </button>
              </div>
            </Field>
            {signingUp && (
              <Field label={t.login.confirm}>
                <Input name="confirm" type={showPassword ? "text" : "password"} autoComplete="new-password" required />
              </Field>
            )}
            {error && <Alert tone="red" title={error} />}
            <Button type="submit" size="lg" className="w-full" loading={submitting}>
              {signingUp ? t.login.create : t.login.signIn}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
