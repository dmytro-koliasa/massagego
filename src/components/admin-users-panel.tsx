"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { Preloader } from "@/components/preloader";

type Filter = "all" | "active" | "blocked" | "deleted";

type AdminUserRow = {
  id: string;
  portal: string;
  email: string;
  phone: string | null;
  name: string | null;
  nameEn: string | null;
  nameUk: string | null;
  blockedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
};

function displayName(user: AdminUserRow) {
  return (
    user.name?.trim() ||
    user.nameEn?.trim() ||
    user.nameUk?.trim() ||
    "—"
  );
}

function statusOf(user: AdminUserRow): "deleted" | "blocked" | "active" {
  if (user.deletedAt) return "deleted";
  if (user.blockedAt) return "blocked";
  return "active";
}

export function AdminUsersPanel() {
  const { t, locale } = useLanguage();
  const [filter, setFilter] = useState<Filter>("all");
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(
          `/api/admin/users?filter=${encodeURIComponent(filter)}`,
          { cache: "no-store" },
        );
        if (cancelled) return;
        if (!response.ok) {
          toast.error(t.adminLoadError);
          setUsers([]);
          return;
        }
        const data = (await response.json()) as { users?: AdminUserRow[] };
        if (cancelled) return;
        setUsers(data.users ?? []);
      } catch {
        if (!cancelled) {
          toast.error(t.adminLoadError);
          setUsers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filter, t.adminLoadError]);

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: t.adminFilterAll },
    { id: "active", label: t.adminFilterActive },
    { id: "blocked", label: t.adminFilterBlocked },
    { id: "deleted", label: t.adminFilterDeleted },
  ];

  function portalLabel(portal: string) {
    if (portal === "client") return t.adminPortalClient;
    if (portal === "admin") return t.adminPortalAdmin;
    return t.adminPortalMasseur;
  }

  function statusLabel(status: ReturnType<typeof statusOf>) {
    if (status === "deleted") return t.adminStatusDeleted;
    if (status === "blocked") return t.adminStatusBlocked;
    return t.adminStatusActive;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">
          {t.adminUsersTitle}
        </h2>
        <div className="flex flex-wrap gap-1">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setFilter(item.id);
                setLoading(true);
              }}
              className={`h-9 rounded-[var(--radius-control)] px-3 text-sm transition ${
                filter === item.id
                  ? "bg-accent text-accent-foreground"
                  : "border border-surface-border text-foreground hover:bg-accent-soft"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Preloader label={t.authPleaseWait} />
        </div>
      ) : !users?.length ? (
        <p className="py-10 text-sm text-muted">{t.adminNoUsers}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-surface-border text-muted">
                <th className="px-2 py-2 font-medium">{t.adminColName}</th>
                <th className="px-2 py-2 font-medium">{t.adminColPortal}</th>
                <th className="px-2 py-2 font-medium">{t.adminColEmail}</th>
                <th className="px-2 py-2 font-medium">{t.adminColStatus}</th>
                <th className="px-2 py-2 font-medium">{t.adminColCreated}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const status = statusOf(user);
                return (
                  <tr
                    key={user.id}
                    className="border-b border-surface-border/70"
                  >
                    <td className="px-2 py-3">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="font-medium text-accent underline-offset-2 hover:underline"
                      >
                        {displayName(user)}
                      </Link>
                    </td>
                    <td className="px-2 py-3 text-foreground">
                      {portalLabel(user.portal)}
                    </td>
                    <td className="px-2 py-3 text-muted">{user.email}</td>
                    <td className="px-2 py-3 text-foreground">
                      {statusLabel(status)}
                    </td>
                    <td className="px-2 py-3 text-muted">
                      {new Date(user.createdAt).toLocaleString(
                        locale === "uk" ? "uk-UA" : "en-GB",
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
