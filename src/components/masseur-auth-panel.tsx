"use client";

import { FormEvent, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import {
  AUTH_INTENT_COOKIE,
  AUTH_PORTAL_COOKIE,
  type AuthIntent,
  type Portal,
} from "@/lib/portals";
import { createNativeValidationHandlers } from "@/lib/native-validation";

type AuthMode = "login" | "register";

type AuthPanelProps = {
  portal?: Portal;
  /** @deprecated Use `portal` */
  role?: Portal;
  callbackUrl?: string;
};

function persistAuthContext(portal: Portal, intent: AuthIntent) {
  document.cookie = `${AUTH_PORTAL_COOKIE}=${portal};path=/;max-age=600;samesite=lax`;
  document.cookie = `${AUTH_INTENT_COOKIE}=${intent};path=/;max-age=600;samesite=lax`;
}

export function MasseurAuthPanel({
  portal,
  role,
  callbackUrl,
}: AuthPanelProps) {
  const resolvedPortal: Portal = portal ?? role ?? "masseur";
  const resolvedCallback =
    callbackUrl ??
    (resolvedPortal === "masseur" ? "/masseur/dashboard" : "/client");

  const { t } = useLanguage();
  const router = useRouter();
  const validation = createNativeValidationHandlers(t);
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [googleConfigured, setGoogleConfigured] = useState(true);

  useEffect(() => {
    persistAuthContext(resolvedPortal, mode === "register" ? "register" : "login");
  }, [resolvedPortal, mode]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/google-status")
      .then((response) => response.json())
      .then((data: { googleConfigured?: boolean }) => {
        if (!cancelled) {
          setGoogleConfigured(Boolean(data.googleConfigured));
        }
      })
      .catch(() => {
        if (!cancelled) setGoogleConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    persistAuthContext(
      resolvedPortal,
      mode === "register" ? "register" : "login",
    );

    try {
      if (mode === "register") {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            password,
            portal: resolvedPortal,
            role: resolvedPortal,
          }),
        });

        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          toast.error(mapRegisterError(data.error, t));
          return;
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error(
          mode === "login" ? t.authInvalidCredentials : t.authGenericError,
        );
        return;
      }

      router.push(resolvedCallback);
      router.refresh();
    } catch {
      toast.error(t.authGenericError);
    } finally {
      setPending(false);
    }
  }

  async function handleGoogle() {
    if (!googleConfigured) {
      toast.error(t.authGoogleUnavailable);
      return;
    }

    setPending(true);
    persistAuthContext(
      resolvedPortal,
      mode === "register" ? "register" : "login",
    );
    try {
      await signIn("google", {
        callbackUrl: resolvedCallback,
        redirect: true,
      });
    } catch {
      toast.error(t.authGoogleUnavailable);
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-surface-border bg-surface p-6 sm:p-8">
      <div
        role="tablist"
        aria-label={t.authTabsLabel}
        className="grid grid-cols-2 gap-1 rounded-[var(--radius-control)] bg-accent-soft p-1"
      >
        <TabButton
          active={mode === "login"}
          onClick={() => setMode("login")}
          label={t.authTabLogin}
        />
        <TabButton
          active={mode === "register"}
          onClick={() => setMode("register")}
          label={t.authTabRegister}
        />
      </div>

      <div className="mt-6 space-y-5">
        <form onSubmit={handleCredentials} className="space-y-4">
          <p className="text-left text-sm font-medium text-muted">
            {t.authCredentialsOption}
          </p>

          {mode === "register" ? (
            <Field
              id="name"
              label={t.authName}
              type="text"
              autoComplete="name"
              value={name}
              onChange={setName}
              required
              validation={validation}
            />
          ) : null}

          <Field
            id="email"
            label={t.authEmail}
            type="email"
            autoComplete="email"
            value={email}
            onChange={setEmail}
            required
            validation={validation}
          />
          <Field
            id="password"
            label={t.authPassword}
            type="password"
            autoComplete={
              mode === "register" ? "new-password" : "current-password"
            }
            value={password}
            onChange={setPassword}
            required
            minLength={mode === "register" ? 8 : undefined}
            validation={validation}
          />

          <button
            type="submit"
            disabled={pending}
            className="flex h-12 w-full items-center justify-center rounded-[var(--radius-control)] bg-accent text-sm font-semibold tracking-[0.02em] text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending
              ? t.authPleaseWait
              : mode === "login"
                ? t.authSignIn
                : t.authCreateAccount}
          </button>
        </form>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-surface-border" />
          <span className="text-xs uppercase tracking-[0.14em] text-muted">
            {t.authOr}
          </span>
          <span className="h-px flex-1 bg-surface-border" />
        </div>

        <div className="space-y-3">
          <p className="text-left text-sm font-medium text-muted">
            {t.authGoogleOption}
          </p>
          <button
            type="button"
            onClick={handleGoogle}
            disabled={pending}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-[var(--radius-control)] border border-surface-border bg-background text-sm font-medium tracking-[0.02em] text-foreground transition hover:border-accent/35 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <GoogleIcon />
            {mode === "login" ? t.authContinueGoogle : t.authRegisterGoogle}
          </button>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-[calc(var(--radius-control)-2px)] px-3 py-2.5 text-sm font-medium tracking-[0.02em] transition ${
        active
          ? "bg-surface text-foreground shadow-sm"
          : "text-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function Field({
  id,
  label,
  type,
  value,
  onChange,
  autoComplete,
  required,
  minLength,
  validation,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  validation: ReturnType<typeof createNativeValidationHandlers>;
}) {
  return (
    <label className="block text-left">
      <span className="mb-1.5 block text-sm text-muted">{label}</span>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        onInvalid={validation.onInvalid}
        onInput={validation.onInput}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-[var(--radius-control)] border border-surface-border bg-background px-4 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-[var(--ring)]"
      />
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.2 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.5 7.1l.1.1 6.2 5.2C36.8 41.3 44 36 44 24c0-1.3-.1-2.5-.4-3.5z"
      />
    </svg>
  );
}

function mapRegisterError(
  code: string | undefined,
  t: ReturnType<typeof useLanguage>["t"],
) {
  switch (code) {
    case "email_taken":
      return t.authEmailTaken;
    case "weak_password":
      return t.authWeakPassword;
    case "missing_fields":
      return t.authMissingFields;
    default:
      return t.authGenericError;
  }
}
