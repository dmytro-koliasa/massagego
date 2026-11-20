"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PasswordField, TextField } from "@/components/form-fields";
import { useLanguage } from "@/components/language-provider";
import {
  AUTH_INTENT_COOKIE,
  AUTH_PORTAL_COOKIE,
  portalDefaultCallback,
} from "@/lib/portals";
import {
  formCardClassName,
  formPrimaryButtonClassName,
} from "@/lib/ui-classes";
import { loginSchema } from "@/lib/validation";

function rateLimitedMessage(
  code: string | undefined | null,
  t: { authRateLimited: string },
) {
  if (!code?.startsWith("rate_limited_")) return null;
  const minutes = Number(code.slice("rate_limited_".length));
  if (!Number.isFinite(minutes) || minutes < 1) {
    return t.authRateLimited.replace("{n}", "1");
  }
  return t.authRateLimited.replace("{n}", String(minutes));
}

export function AdminAuthPanel() {
  const { t } = useLanguage();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const parsed = loginSchema.safeParse({ email, password });
      if (!parsed.success) {
        toast.error(t.authInvalidCredentials);
        return;
      }

      document.cookie = `${AUTH_PORTAL_COOKIE}=admin;path=/;max-age=600;samesite=lax`;
      document.cookie = `${AUTH_INTENT_COOKIE}=login;path=/;max-age=600;samesite=lax`;

      const result = await signIn("credentials", {
        email: parsed.data.email,
        password: parsed.data.password,
        redirect: false,
      });
      if (result?.error) {
        if (result.code === "blocked") {
          toast.error(t.authAccountBlocked);
        } else {
          const limited = rateLimitedMessage(result.code, t);
          toast.error(limited ?? t.authInvalidCredentials);
        }
        return;
      }
      router.push(portalDefaultCallback("admin"));
      router.refresh();
    } catch {
      toast.error(t.authGenericError);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={`${formCardClassName} mx-auto`}>
      <form onSubmit={onSubmit} className="space-y-4">
        <TextField
          id="admin-email"
          label={t.authEmail}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={setEmail}
        />
        <PasswordField
          id="admin-password"
          label={t.authPassword}
          autoComplete="current-password"
          required
          value={password}
          onChange={setPassword}
          visible={showPassword}
          onToggleVisible={() => setShowPassword((value) => !value)}
          showLabel={t.authShowPassword}
          hideLabel={t.authHidePassword}
        />
        <button
          type="submit"
          disabled={pending}
          className={formPrimaryButtonClassName}
        >
          {pending ? t.authPleaseWait : t.adminSignIn}
        </button>
      </form>
    </div>
  );
}
