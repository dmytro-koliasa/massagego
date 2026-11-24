"use client";

import { FormEvent, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { Country } from "react-phone-number-input/max";
import { PasswordField } from "@/components/form-fields";
import { useLanguage } from "@/components/language-provider";
import {
  formCardClassName,
  formPrimaryButtonClassName,
} from "@/lib/ui-classes";
import type { CanonicalCity } from "@/lib/city";
import { portalHomePath, type Portal } from "@/lib/portals";
import { createNativeValidationHandlers } from "@/lib/native-validation";
import {
  clientLoginSchema,
  clientRegisterSchema,
  loginSchema,
  PASSWORD_MAX,
  PASSWORD_MIN,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  registerSchema,
  zodErrorCode,
} from "@/lib/validation";
import { GoogleIcon, TabButton } from "./auth-chrome";
import { ForgotForm } from "./forgot-form";
import { LoginForm } from "./login-form";
import { RegisterForm, RegisterFormFooter } from "./register-form";
import { ResetPasswordForm } from "./reset-password-form";
import {
  mapRegisterError,
  persistAuthContext,
  rateLimitedMessage,
  signInErrorMessage,
} from "./helpers";
import type { AuthMode, AuthPanelProps } from "./types";

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

  const { t, locale } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetToken = searchParams.get("resetToken")?.trim() || "";
  const validation = createNativeValidationHandlers(t);
  const [mode, setMode] = useState<AuthMode>(
    resolvedPortal === "client" ? "register" : "login",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cityLabel, setCityLabel] = useState("");
  const [city, setCity] = useState<CanonicalCity | null>(null);
  const [phone, setPhone] = useState<string | undefined>();
  const [phoneCountry, setPhoneCountry] = useState<Country>("UA");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [googleConfigured, setGoogleConfigured] = useState(true);

  useEffect(() => {
    if (mode === "forgot") return;
    persistAuthContext(
      resolvedPortal,
      mode === "register" ? "register" : "login",
    );
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
            email,
            city,
            password,
            passwordConfirm,
            preferredLocale: locale,
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
              email: parsed.data.email,
              city: parsed.data.city,
              password: parsed.data.password,
              passwordConfirm: parsed.data.passwordConfirm,
              preferredLocale: parsed.data.preferredLocale ?? locale,
              portal: "client",
              role: "client",
            }),
          });

          if (!response.ok) {
            const data = (await response.json().catch(() => ({}))) as {
              error?: string;
              message?: string;
            };
            if (response.status === 429) {
              toast.error(data.message || t.authRateLimited.replace("{n}", "1"));
              return;
            }
            toast.error(mapRegisterError(data.error, t));
            return;
          }

          toast.success(t.authVerifyEmailSent);

          const result = await signIn("credentials", {
            phone: parsed.data.phone,
            password: parsed.data.password,
            redirect: false,
            callbackUrl: resolvedCallback,
          });

          if (!result || result.error) {
            const limited = rateLimitedMessage(result?.code, t);
            if (limited) {
              toast.error(limited);
              return;
            }
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
            toast.error(signInErrorMessage(result.code, t, "phone"));
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
          preferredLocale: locale,
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
          const data = (await response.json().catch(() => ({}))) as {
            error?: string;
            message?: string;
          };
          if (response.status === 429) {
            toast.error(data.message || t.authRateLimited.replace("{n}", "1"));
            return;
          }
          toast.error(mapRegisterError(data.error, t));
          return;
        }

        if (resolvedPortal === "masseur") {
          toast.success(t.authVerifyEmailSent);
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
          signInErrorMessage(
            result.code,
            t,
            mode === "login" ? "email" : "generic",
          ),
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

  async function handleForgotRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      const payload = isClient
        ? {
            portal: "client" as const,
            phone: phone ?? "",
            preferredLocale: locale,
          }
        : {
            portal: "masseur" as const,
            email,
            preferredLocale: locale,
          };
      const parsed = passwordResetRequestSchema.safeParse(payload);
      if (!parsed.success) {
        toast.error(mapRegisterError(zodErrorCode(parsed.error), t));
        return;
      }

      const response = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      if (response.status === 429) {
        toast.error(data.message || t.authRateLimited.replace("{n}", "1"));
        return;
      }
      if (!response.ok) {
        toast.error(mapRegisterError(data.error, t));
        return;
      }
      toast.success(data.message || t.authPasswordResetSent);
      setMode("login");
    } catch {
      toast.error(t.authGenericError);
    } finally {
      setPending(false);
    }
  }

  async function handleResetConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      const parsed = passwordResetConfirmSchema.safeParse({
        token: resetToken,
        password,
        passwordConfirm,
      });
      if (!parsed.success) {
        toast.error(mapRegisterError(zodErrorCode(parsed.error), t));
        return;
      }

      const response = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        toast.error(
          data.error === "invalid_token"
            ? t.authResetTokenInvalid
            : mapRegisterError(data.error, t),
        );
        return;
      }

      toast.success(t.authResetPasswordSuccess);
      setPassword("");
      setPasswordConfirm("");
      router.replace(portalHomePath(resolvedPortal));
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

  if (resetToken) {
    return (
      <ResetPasswordForm
        pending={pending}
        t={t}
        validation={validation}
        password={password}
        setPassword={setPassword}
        passwordConfirm={passwordConfirm}
        setPasswordConfirm={setPasswordConfirm}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        showPasswordConfirm={showPasswordConfirm}
        setShowPasswordConfirm={setShowPasswordConfirm}
        onSubmit={handleResetConfirm}
      />
    );
  }

  if (mode === "forgot") {
    return (
      <ForgotForm
        isClient={isClient}
        pending={pending}
        t={t}
        validation={validation}
        phone={phone}
        setPhone={setPhone}
        phoneCountry={phoneCountry}
        setPhoneCountry={setPhoneCountry}
        email={email}
        setEmail={setEmail}
        onSubmit={handleForgotRequest}
        onBackToLogin={() => setMode("login")}
      />
    );
  }

  return (
    <div className={formCardClassName}>
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

          {mode === "login" ? (
            <LoginForm
              isClient={isClient}
              t={t}
              validation={validation}
              phone={phone}
              setPhone={setPhone}
              phoneCountry={phoneCountry}
              setPhoneCountry={setPhoneCountry}
              email={email}
              setEmail={setEmail}
            />
          ) : (
            <RegisterForm
              isClient={isClient}
              t={t}
              locale={locale}
              validation={validation}
              name={name}
              setName={setName}
              email={email}
              setEmail={setEmail}
              cityLabel={cityLabel}
              setCityLabel={setCityLabel}
              setCity={setCity}
              phone={phone}
              setPhone={setPhone}
              phoneCountry={phoneCountry}
              setPhoneCountry={setPhoneCountry}
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

          {mode === "login" ? (
            <div className="text-left">
              <button
                type="button"
                onClick={() => setMode("forgot")}
                className="text-sm text-accent underline-offset-2 transition hover:underline"
              >
                {t.authForgotPassword}
              </button>
            </div>
          ) : (
            <RegisterFormFooter
              t={t}
              passwordConfirm={passwordConfirm}
              setPasswordConfirm={setPasswordConfirm}
              showPasswordConfirm={showPasswordConfirm}
              setShowPasswordConfirm={setShowPasswordConfirm}
              validation={validation}
            />
          )}

          <button
            type="submit"
            disabled={pending}
            className={formPrimaryButtonClassName}
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