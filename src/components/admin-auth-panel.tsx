"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import {
  AUTH_INTENT_COOKIE,
  AUTH_PORTAL_COOKIE,
  portalDefaultCallback,
} from "@/lib/portals";
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
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-md space-y-4">
      <label className="block text-left text-sm">
        <span className="mb-1.5 block text-muted">{t.authEmail}</span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-12 w-full rounded-lg border border-surface-border bg-background px-4 text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-[var(--ring)]"
        />
      </label>
      <label className="block text-left text-sm">
        <span className="mb-1.5 block text-muted">{t.authPassword}</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-12 w-full rounded-lg border border-surface-border bg-background px-4 text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-[var(--ring)]"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="flex h-12 w-full items-center justify-center rounded-[var(--radius-control)] bg-accent text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? t.authPleaseWait : t.adminSignIn}
      </button>
    </form>
  );
}
