"use client";

import { FormEvent, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import PhoneInput, {
  type Country,
} from "react-phone-number-input/max";
import flags from "react-phone-number-input/flags";
import "react-phone-number-input/style.css";
import { useLanguage } from "@/components/language-provider";
import {
  AUTH_INTENT_COOKIE,
  AUTH_PORTAL_COOKIE,
  type AuthIntent,
  type Portal,
} from "@/lib/portals";
import { createNativeValidationHandlers } from "@/lib/native-validation";
import { PHONE_COUNTRIES_EU_UA } from "@/lib/phone-countries";
import {
  clampInternationalPhone,
  nationalPhoneInsert,
} from "@/lib/phone";
import {
  clientLoginSchema,
  clientRegisterSchema,
  EMAIL_MAX,
  loginSchema,
  NAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  registerSchema,
  zodErrorCode,
} from "@/lib/validation";

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
  const isClient = resolvedPortal === "client";
  const resolvedCallback =
    callbackUrl ??
    (resolvedPortal === "masseur"
      ? "/masseur/dashboard"
      : "/client");

  const { t } = useLanguage();
  const router = useRouter();
  const validation = createNativeValidationHandlers(t);
  const [mode, setMode] = useState<AuthMode>(
    resolvedPortal === "client" ? "register" : "login",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState<string | undefined>();
  const [phoneCountry, setPhoneCountry] = useState<Country>("UA");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [googleConfigured, setGoogleConfigured] = useState(true);

  useEffect(() => {
    persistAuthContext(resolvedPortal, mode === "register" ? "register" : "login");
  }, [resolvedPortal, mode]);

  useEffect(() => {
    if (isClient) return;
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
  }, [isClient]);

  async function handleCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    persistAuthContext(
      resolvedPortal,
      mode === "register" ? "register" : "login",
    );

    try {
      if (isClient) {
        if (mode === "register") {
          const parsed = clientRegisterSchema.safeParse({
            name,
            phone: phone ?? "",
            password,
            passwordConfirm,
            portal: "client",
            role: "client",
          });
          if (!parsed.success) {
            toast.error(mapRegisterError(zodErrorCode(parsed.error), t));
            return;
          }

          const response = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: parsed.data.name,
              phone: parsed.data.phone,
              password: parsed.data.password,
              passwordConfirm: parsed.data.passwordConfirm,
              portal: "client",
              role: "client",
            }),
          });

          if (!response.ok) {
            const data = (await response.json().catch(() => ({}))) as {
              error?: string;
            };
            toast.error(mapRegisterError(data.error, t));
            return;
          }

          const result = await signIn("credentials", {
            phone: parsed.data.phone,
            password: parsed.data.password,
            redirect: false,
            callbackUrl: resolvedCallback,
          });

          if (!result || result.error) {
            toast.success(t.authAccountCreatedSignIn);
            setMode("login");
            setPassword("");
            setPasswordConfirm("");
            return;
          }
        } else {
          const parsed = clientLoginSchema.safeParse({
            phone: phone ?? "",
            password,
          });
          if (!parsed.success) {
            toast.error(mapRegisterError(zodErrorCode(parsed.error), t));
            return;
          }

          const result = await signIn("credentials", {
            phone: parsed.data.phone,
            password: parsed.data.password,
            redirect: false,
          });

          if (result?.error) {
            toast.error(t.authInvalidPhoneCredentials);
            return;
          }
        }

        router.push(resolvedCallback);
        router.refresh();
        return;
      }

      if (mode === "register") {
        const parsed = registerSchema.safeParse({
          name,
          email,
          password,
          passwordConfirm,
          portal: resolvedPortal,
          role: resolvedPortal,
        });
        if (!parsed.success) {
          toast.error(mapRegisterError(zodErrorCode(parsed.error), t));
          return;
        }

        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        });

        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          toast.error(mapRegisterError(data.error, t));
          return;
        }
      } else {
        const parsed = loginSchema.safeParse({ email, password });
        if (!parsed.success) {
          toast.error(mapRegisterError(zodErrorCode(parsed.error), t));
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
        <form onSubmit={handleCredentials} className="space-y-4" noValidate>
          {!isClient ? (
            <p className="text-left text-sm font-medium text-muted">
              {t.authCredentialsOption}
            </p>
          ) : null}

          {mode === "register" ? (
            <Field
              id="name"
              label={t.authName}
              type="text"
              autoComplete="name"
              value={name}
              onChange={setName}
              required
              maxLength={NAME_MAX}
              validation={validation}
            />
          ) : null}

          {isClient ? (
            <label className="block text-left">
              <span className="mb-1.5 block text-sm text-muted">
                {t.authPhone}
              </span>
              <PhoneInput
                international
                countryCallingCodeEditable={false}
                defaultCountry="UA"
                countries={[...PHONE_COUNTRIES_EU_UA]}
                addInternationalOption={false}
                flags={flags}
                limitMaxLength
                value={phone}
                onChange={(value) =>
                  setPhone(clampInternationalPhone(value, phoneCountry))
                }
                onCountryChange={(country) => {
                  if (!country) return;
                  setPhoneCountry(country);
                  setPhone((current) =>
                    clampInternationalPhone(current, country),
                  );
                }}
                className="PhoneInputField"
                numberInputProps={{
                  name: "tel",
                  autoComplete: "tel",
                  required: true,
                  className:
                    "PhoneInputInput h-12 w-full rounded-lg border-0 bg-transparent pr-3 pl-1.5 text-foreground outline-none",
                  onBeforeInput: (event: FormEvent<HTMLInputElement>) => {
                    const inserted =
                      (event.nativeEvent as InputEvent).data ?? "";
                    const input = event.currentTarget;
                    const start =
                      input.selectionStart ?? input.value.length;
                    const end = input.selectionEnd ?? input.value.length;
                    const next = nationalPhoneInsert(
                      input.value,
                      start,
                      end,
                      inserted,
                      phoneCountry,
                    );
                    if (!next.exceeds) return;
                    event.preventDefault();
                    setPhone(next.value);
                  },
                }}
              />
            </label>
          ) : (
            <Field
              id="email"
              label={t.authEmail}
              type="email"
              autoComplete="email"
              value={email}
              onChange={setEmail}
              required
              maxLength={EMAIL_MAX}
              validation={validation}
            />
          )}

          <PasswordField
            id="password"
            label={t.authPassword}
            autoComplete={
              mode === "register" ? "new-password" : "current-password"
            }
            value={password}
            onChange={setPassword}
            visible={showPassword}
            onToggleVisible={() => setShowPassword((value) => !value)}
            showLabel={t.authShowPassword}
            hideLabel={t.authHidePassword}
            required
            minLength={PASSWORD_MIN}
            maxLength={PASSWORD_MAX}
            validation={validation}
          />

          {mode === "register" ? (
            <PasswordField
              id="passwordConfirm"
              label={t.authPasswordConfirm}
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={setPasswordConfirm}
              visible={showPasswordConfirm}
              onToggleVisible={() =>
                setShowPasswordConfirm((value) => !value)
              }
              showLabel={t.authShowPassword}
              hideLabel={t.authHidePassword}
              required
              minLength={PASSWORD_MIN}
              maxLength={PASSWORD_MAX}
              validation={validation}
            />
          ) : null}

          {mode === "login" ? (
            <div className="text-left">
              <button
                type="button"
                onClick={() => toast.message(t.authForgotPasswordHint)}
                className="text-sm text-accent underline-offset-2 transition hover:underline"
              >
                {t.authForgotPassword}
              </button>
            </div>
          ) : null}

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

        {!isClient ? (
          <>
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
          </>
        ) : null}
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
  maxLength,
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
  maxLength?: number;
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
        maxLength={maxLength}
        onInvalid={validation.onInvalid}
        onInput={validation.onInput}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-[var(--radius-control)] border border-surface-border bg-background px-4 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-[var(--ring)]"
      />
    </label>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  required,
  minLength,
  maxLength,
  validation,
  visible,
  onToggleVisible,
  showLabel,
  hideLabel,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  validation: ReturnType<typeof createNativeValidationHandlers>;
  visible: boolean;
  onToggleVisible: () => void;
  showLabel: string;
  hideLabel: string;
}) {
  return (
    <label className="block text-left">
      <span className="mb-1.5 block text-sm text-muted">{label}</span>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          onInvalid={validation.onInvalid}
          onInput={validation.onInput}
          onChange={(event) => onChange(event.target.value)}
          className="h-12 w-full rounded-[var(--radius-control)] border border-surface-border bg-background px-4 pr-12 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-[var(--ring)]"
        />
        <button
          type="button"
          onClick={onToggleVisible}
          aria-label={visible ? hideLabel : showLabel}
          className="absolute top-1/2 right-3 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted transition hover:text-foreground"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </label>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.75" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 3l18 18"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M10.6 10.7a2.75 2.75 0 0 0 3.7 3.7M9.5 5.2A10.6 10.6 0 0 1 12 5c6 0 9.5 7 9.5 7a16.7 16.7 0 0 1-3.2 3.9M6.2 6.3C4.1 7.8 2.5 12 2.5 12s3.5 7 9.5 7c1.5 0 2.9-.4 4.1-1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
    case "phone_taken":
      return t.authPhoneTaken;
    case "weak_password":
      return t.authWeakPassword;
    case "password_mismatch":
      return t.authPasswordMismatch;
    case "invalid_phone":
      return t.authInvalidPhone;
    case "invalid_email":
    case "missing_fields":
      return t.authMissingFields;
    default:
      return t.authGenericError;
  }
}
