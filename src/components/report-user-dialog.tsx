"use client";

import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { COMPLAINT_CATEGORIES } from "@/lib/complaints";
import {
  portalRequestHeaders,
  type PublicPortal,
} from "@/lib/portals";

type ReportUserDialogProps = {
  bookingId: string;
  /** Portal UI that opened the dialog — sent as X-Portal for dual-session (#88). */
  portal: PublicPortal;
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
};

export function ReportUserDialog({
  bookingId,
  portal,
  open,
  onClose,
  onSubmitted,
}: ReportUserDialogProps) {
  const { t } = useLanguage();
  const [category, setCategory] =
    useState<(typeof COMPLAINT_CATEGORIES)[number]>("rude");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);

  if (!open) return null;

  function categoryLabel(value: (typeof COMPLAINT_CATEGORIES)[number]) {
    if (value === "no_show") return t.complaintCategoryNoShow;
    if (value === "rude") return t.complaintCategoryRude;
    if (value === "spam") return t.complaintCategorySpam;
    return t.complaintCategoryOther;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const trimmed = body.trim();
    if (!trimmed) {
      toast.error(t.complaintBodyRequired);
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/complaints", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...portalRequestHeaders(portal),
        },
        body: JSON.stringify({
          bookingId,
          category,
          body: trimmed,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;
      if (!response.ok) {
        if (response.status === 429 || data?.error === "rate_limited") {
          toast.error(data?.message || t.authRateLimited.replace("{n}", "1"));
        } else if (
          data?.error === "booking_not_found" ||
          data?.error === "no_relationship" ||
          data?.error === "walk_in"
        ) {
          toast.error(t.complaintNotAllowed);
        } else {
          toast.error(t.complaintSubmitError);
        }
        return;
      }
      toast.success(t.complaintSubmitSuccess);
      setBody("");
      setCategory("rude");
      onSubmitted?.();
      onClose();
    } catch {
      toast.error(t.complaintSubmitError);
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="presentation"
      onClick={() => {
        if (!pending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-user-title"
        className="w-full max-w-sm rounded-xl border border-surface-border bg-background p-5 shadow-[0_24px_60px_rgba(0,0,0,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="report-user-title"
          className="text-base font-medium text-foreground"
        >
          {t.complaintDialogTitle}
        </h2>
        <p className="mt-1 text-sm text-muted">{t.complaintDialogSupport}</p>
        <form className="mt-4 space-y-3" onSubmit={onSubmit} noValidate>
          <label className="block text-left">
            <span className="mb-1.5 block text-sm text-muted">
              {t.complaintCategoryLabel}
            </span>
            <select
              value={category}
              onChange={(event) =>
                setCategory(
                  event.target.value as (typeof COMPLAINT_CATEGORIES)[number],
                )
              }
              className="h-11 w-full text-foreground"
              disabled={pending}
            >
              {COMPLAINT_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {categoryLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-left">
            <span className="mb-1.5 block text-sm text-muted">
              {t.complaintBodyLabel}
            </span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={500}
              rows={4}
              required
              disabled={pending}
              className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm text-foreground"
              placeholder={t.complaintBodyPlaceholder}
            />
          </label>
          <div className="flex flex-col gap-2 pt-1">
            <button
              type="submit"
              disabled={pending}
              className="flex h-11 w-full items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {pending ? t.authPleaseWait : t.complaintSubmit}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={onClose}
              className="flex h-10 w-full items-center justify-center text-sm text-muted transition hover:text-foreground disabled:opacity-60"
            >
              {t.complaintCancel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
