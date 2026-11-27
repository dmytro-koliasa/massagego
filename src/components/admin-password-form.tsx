"use client";

import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";

export function AdminPasswordForm() {
  const { t } = useLanguage();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    try {
      const response = await fetch("/api/admin/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: String(data.get("currentPassword") ?? ""),
          password: String(data.get("password") ?? ""),
          passwordConfirm: String(data.get("passwordConfirm") ?? ""),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        if (payload.error === "invalid_current") {
          toast.error(t.adminPasswordInvalidCurrent);
        } else if (payload.error === "same_password") {
          toast.error(t.adminPasswordSame);
        } else if (payload.error === "password_mismatch") {
          toast.error(t.authPasswordMismatch);
        } else {
          toast.error(t.adminPasswordError);
        }
        return;
      }
      toast.success(t.adminPasswordSuccess);
      form.reset();
    } catch {
      toast.error(t.adminPasswordError);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4">
      <p className="text-sm text-muted">{t.adminPasswordSupport}</p>
      <label className="block space-y-1.5">
        <span className="text-sm text-foreground">
          {t.adminPasswordCurrent}
        </span>
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className="h-11 w-full rounded-lg border border-surface-border bg-surface px-3 text-sm"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-foreground">{t.adminPasswordNew}</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          className="h-11 w-full rounded-lg border border-surface-border bg-surface px-3 text-sm"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-foreground">
          {t.adminPasswordConfirm}
        </span>
        <input
          name="passwordConfirm"
          type="password"
          autoComplete="new-password"
          required
          className="h-11 w-full rounded-lg border border-surface-border bg-surface px-3 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-lg bg-accent px-5 text-sm font-medium text-accent-foreground disabled:opacity-60"
      >
        {t.adminPasswordSubmit}
      </button>
    </form>
  );
}
