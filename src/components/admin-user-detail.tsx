"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useLanguage } from "@/components/language-provider";
import { Preloader } from "@/components/preloader";

type AdminUserDetail = {
  id: string;
  portal: string;
  email: string;
  emailVerified: string | null;
  phone: string | null;
  phoneConfirmedAt: string | null;
  name: string | null;
  nameEn: string | null;
  nameUk: string | null;
  slug: string | null;
  image: string | null;
  descriptionEn: string | null;
  descriptionUk: string | null;
  city: string | null;
  cityPlaceId: string | null;
  cityCountryCode: string | null;
  cityNameEn: string | null;
  cityNameUk: string | null;
  address: string | null;
  timezone: string;
  preferredLocale: string;
  bookingLeadHours: number;
  cancelCutoffHours: number;
  telegramChatId: string | null;
  telegramLinkedAt: string | null;
  blockedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-surface-border/60 py-2 sm:grid sm:grid-cols-[12rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-foreground sm:mt-0">
        {value || "—"}
      </dd>
    </div>
  );
}

function fmt(
  value: string | null | undefined,
  locale: string,
): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale === "uk" ? "uk-UA" : "en-GB");
}

export function AdminUserDetail({ userId }: { userId: string }) {
  const { t, locale } = useLanguage();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState<"block" | "unblock" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        toast.error(t.adminLoadError);
        setUser(null);
        return;
      }
      const data = (await response.json()) as { user?: AdminUserDetail };
      setUser(data.user ?? null);
    } catch {
      toast.error(t.adminLoadError);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [userId, t.adminLoadError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function applyAction() {
    if (!user || !confirm) return;
    setPending(true);
    try {
      const path =
        confirm === "block"
          ? `/api/admin/users/${user.id}/block`
          : `/api/admin/users/${user.id}/unblock`;
      const response = await fetch(path, { method: "POST" });
      if (!response.ok) {
        toast.error(t.adminActionError);
        return;
      }
      toast.success(t.adminActionLogged);
      setConfirm(null);
      await load();
    } catch {
      toast.error(t.adminActionError);
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Preloader label={t.authPleaseWait} />
      </div>
    );
  }

  if (!user) {
    return <p className="text-sm text-muted">{t.adminLoadError}</p>;
  }

  const canModerate =
    (user.portal === "client" || user.portal === "masseur") && !user.deletedAt;
  const isBlocked = Boolean(user.blockedAt);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/admin"
            className="text-sm text-accent underline-offset-2 hover:underline"
          >
            {t.adminBackToUsers}
          </Link>
          <h2 className="mt-2 text-lg font-semibold text-foreground">
            {t.adminUserDetailTitle}
          </h2>
        </div>
        {canModerate ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirm(isBlocked ? "unblock" : "block")}
            className={`h-10 rounded-[var(--radius-control)] px-4 text-sm font-medium text-white disabled:opacity-60 ${
              isBlocked
                ? "bg-accent hover:opacity-90"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {isBlocked ? t.adminUnblock : t.adminBlock}
          </button>
        ) : null}
      </div>

      <dl>
        <Field label="ID" value={user.id} />
        <Field
          label={t.adminColPortal}
          value={
            user.portal === "client"
              ? t.adminPortalClient
              : user.portal === "admin"
                ? t.adminPortalAdmin
                : t.adminPortalMasseur
          }
        />
        <Field label={t.adminColEmail} value={user.email} />
        <Field label={t.adminColPhone} value={user.phone ?? ""} />
        <Field label={t.adminFieldName} value={user.name ?? ""} />
        <Field label={t.adminFieldNameEn} value={user.nameEn ?? ""} />
        <Field label={t.adminFieldNameUk} value={user.nameUk ?? ""} />
        <Field label={t.adminFieldSlug} value={user.slug ?? ""} />
        <Field
          label={t.adminFieldCity}
          value={
            user.cityNameEn ||
            user.cityNameUk ||
            user.city ||
            user.cityPlaceId ||
            ""
          }
        />
        <Field label={t.adminFieldAddress} value={user.address ?? ""} />
        <Field label={t.adminFieldTimezone} value={user.timezone} />
        <Field
          label={t.adminFieldLocale}
          value={user.preferredLocale}
        />
        <Field
          label={t.adminFieldEmailVerified}
          value={fmt(user.emailVerified, locale)}
        />
        <Field
          label={t.adminFieldPhoneConfirmed}
          value={fmt(user.phoneConfirmedAt, locale)}
        />
        <Field
          label={t.adminFieldTelegram}
          value={
            user.telegramChatId
              ? `${user.telegramChatId} (${fmt(user.telegramLinkedAt, locale)})`
              : ""
          }
        />
        <Field
          label={t.adminColStatus}
          value={
            user.deletedAt
              ? t.adminStatusDeleted
              : user.blockedAt
                ? t.adminStatusBlocked
                : t.adminStatusActive
          }
        />
        <Field
          label={t.adminFieldBlockedAt}
          value={fmt(user.blockedAt, locale)}
        />
        <Field
          label={t.adminFieldDeletedAt}
          value={fmt(user.deletedAt, locale)}
        />
        <Field
          label={t.adminColCreated}
          value={fmt(user.createdAt, locale)}
        />
        <Field
          label={t.adminFieldUpdatedAt}
          value={fmt(user.updatedAt, locale)}
        />
      </dl>

      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm === "unblock"
            ? t.adminUnblockConfirmTitle
            : t.adminBlockConfirmTitle
        }
        message={
          confirm === "unblock"
            ? t.adminUnblockConfirmMessage
            : t.adminBlockConfirmMessage
        }
        confirmLabel={confirm === "unblock" ? t.adminUnblock : t.adminBlock}
        cancelLabel={t.deleteAccountCancel}
        pending={pending}
        danger={confirm === "block"}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void applyAction()}
      />
    </div>
  );
}
