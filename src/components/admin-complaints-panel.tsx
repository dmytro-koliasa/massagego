"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { Preloader } from "@/components/preloader";

type Filter = "all" | "open" | "resolved" | "dismissed";

type ComplaintRow = {
  id: string;
  category: string;
  body: string;
  status: Filter extends "all" ? string : Filter;
  adminNote: string | null;
  bookingId: string | null;
  createdAt: string;
  resolvedAt: string | null;
  reporter: {
    id: string;
    portal: string;
    email: string;
    name: string | null;
    nameEn: string | null;
    nameUk: string | null;
  };
  target: {
    id: string;
    portal: string;
    email: string;
    name: string | null;
    nameEn: string | null;
    nameUk: string | null;
    blockedAt: string | null;
  };
};

function displayName(user: {
  name: string | null;
  nameEn: string | null;
  nameUk: string | null;
  email: string;
}) {
  return (
    user.name?.trim() ||
    user.nameEn?.trim() ||
    user.nameUk?.trim() ||
    user.email
  );
}

export function AdminComplaintsPanel() {
  const { t, locale } = useLanguage();
  const [filter, setFilter] = useState<Filter>("open");
  const [rows, setRows] = useState<ComplaintRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/complaints?filter=${encodeURIComponent(filter)}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        toast.error(t.adminLoadError);
        setRows([]);
        return;
      }
      const data = (await response.json()) as { complaints?: ComplaintRow[] };
      const list = data.complaints ?? [];
      setRows(list);
      setNotes(
        Object.fromEntries(
          list.map((row) => [row.id, row.adminNote ?? ""]),
        ),
      );
    } catch {
      toast.error(t.adminLoadError);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filter, t.adminLoadError]);

  useEffect(() => {
    void load();
  }, [load]);

  function categoryLabel(value: string) {
    if (value === "no_show") return t.complaintCategoryNoShow;
    if (value === "rude") return t.complaintCategoryRude;
    if (value === "spam") return t.complaintCategorySpam;
    return t.complaintCategoryOther;
  }

  function statusLabel(value: string) {
    if (value === "resolved") return t.complaintStatusResolved;
    if (value === "dismissed") return t.complaintStatusDismissed;
    return t.complaintStatusOpen;
  }

  async function patchComplaint(
    id: string,
    patch: { status?: "open" | "resolved" | "dismissed"; adminNote?: string },
  ) {
    setPendingId(id);
    try {
      const response = await fetch(`/api/admin/complaints/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        toast.error(t.adminComplaintsSaveError);
        return;
      }
      toast.success(t.adminComplaintsSaved);
      await load();
    } catch {
      toast.error(t.adminComplaintsSaveError);
    } finally {
      setPendingId(null);
    }
  }

  const filters: { id: Filter; label: string }[] = [
    { id: "open", label: t.complaintStatusOpen },
    { id: "resolved", label: t.complaintStatusResolved },
    { id: "dismissed", label: t.complaintStatusDismissed },
    { id: "all", label: t.adminFilterAll },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">
          {t.adminComplaintsTitle}
        </h2>
        <div className="flex flex-wrap gap-1">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                filter === item.id
                  ? "bg-accent text-white"
                  : "text-muted hover:bg-surface hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Preloader />
      ) : !rows || rows.length === 0 ? (
        <p className="text-sm text-muted">{t.adminComplaintsEmpty}</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-xl border border-surface-border bg-surface/40 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {categoryLabel(row.category)} · {statusLabel(row.status)}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {new Date(row.createdAt).toLocaleString(
                      locale === "uk" ? "uk-UA" : "en-GB",
                    )}
                  </p>
                </div>
                <Link
                  href={`/admin/users/${row.target.id}`}
                  className="text-sm text-accent underline-offset-2 hover:underline"
                >
                  {t.adminComplaintsViewTarget}
                </Link>
              </div>
              <p className="mt-3 text-sm text-foreground whitespace-pre-wrap">
                {row.body}
              </p>
              <p className="mt-2 text-xs text-muted">
                {t.adminComplaintsReporter}: {displayName(row.reporter)} (
                {row.reporter.portal}) → {displayName(row.target)} (
                {row.target.portal}
                {row.target.blockedAt ? `, ${t.adminStatusBlocked}` : ""})
              </p>
              <label className="mt-3 block">
                <span className="mb-1 block text-xs text-muted">
                  {t.adminComplaintsNote}
                </span>
                <textarea
                  value={notes[row.id] ?? ""}
                  onChange={(event) =>
                    setNotes((current) => ({
                      ...current,
                      [row.id]: event.target.value,
                    }))
                  }
                  rows={2}
                  maxLength={1000}
                  className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm text-foreground"
                  disabled={pendingId === row.id}
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pendingId === row.id}
                  onClick={() =>
                    void patchComplaint(row.id, {
                      adminNote: notes[row.id] ?? "",
                    })
                  }
                  className="rounded-lg border border-surface-border px-3 py-1.5 text-sm text-foreground transition hover:border-accent/40 disabled:opacity-60"
                >
                  {t.adminComplaintsSaveNote}
                </button>
                {row.status !== "resolved" ? (
                  <button
                    type="button"
                    disabled={pendingId === row.id}
                    onClick={() =>
                      void patchComplaint(row.id, {
                        status: "resolved",
                        adminNote: notes[row.id] ?? "",
                      })
                    }
                    className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
                  >
                    {t.complaintStatusResolved}
                  </button>
                ) : null}
                {row.status !== "dismissed" ? (
                  <button
                    type="button"
                    disabled={pendingId === row.id}
                    onClick={() =>
                      void patchComplaint(row.id, {
                        status: "dismissed",
                        adminNote: notes[row.id] ?? "",
                      })
                    }
                    className="rounded-lg border border-surface-border px-3 py-1.5 text-sm text-foreground transition hover:border-accent/40 disabled:opacity-60"
                  >
                    {t.complaintStatusDismissed}
                  </button>
                ) : null}
                {row.status !== "open" ? (
                  <button
                    type="button"
                    disabled={pendingId === row.id}
                    onClick={() =>
                      void patchComplaint(row.id, { status: "open" })
                    }
                    className="rounded-lg border border-surface-border px-3 py-1.5 text-sm text-muted transition hover:text-foreground disabled:opacity-60"
                  >
                    {t.complaintStatusOpen}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
