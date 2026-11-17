"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { Preloader } from "@/components/preloader";

type AuditEntry = {
  id: string;
  action: string;
  actorUserId: string;
  actorEmail: string;
  actorName: string | null;
  targetUserId: string | null;
  metaJson: string | null;
  createdAt: string;
};

export function AdminAuditPanel() {
  const { t, locale } = useLanguage();
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/audit", { cache: "no-store" });
      if (!response.ok) {
        toast.error(t.adminLoadError);
        setEntries([]);
        return;
      }
      const data = (await response.json()) as { entries?: AuditEntry[] };
      setEntries(data.entries ?? []);
    } catch {
      toast.error(t.adminLoadError);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [t.adminLoadError]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">
        {t.adminAuditTitle}
      </h2>

      {loading ? (
        <div className="flex justify-center py-16">
          <Preloader label={t.authPleaseWait} />
        </div>
      ) : !entries?.length ? (
        <p className="py-10 text-sm text-muted">{t.adminNoAudit}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-surface-border text-muted">
                <th className="px-2 py-2 font-medium">{t.adminColCreated}</th>
                <th className="px-2 py-2 font-medium">{t.adminColAction}</th>
                <th className="px-2 py-2 font-medium">{t.adminColActor}</th>
                <th className="px-2 py-2 font-medium">{t.adminColTarget}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-surface-border/70"
                >
                  <td className="px-2 py-3 text-muted">
                    {new Date(entry.createdAt).toLocaleString(
                      locale === "uk" ? "uk-UA" : "en-GB",
                    )}
                  </td>
                  <td className="px-2 py-3 text-foreground">{entry.action}</td>
                  <td className="px-2 py-3 text-muted">
                    {entry.actorName || entry.actorEmail}
                  </td>
                  <td className="px-2 py-3">
                    {entry.targetUserId ? (
                      <Link
                        href={`/admin/users/${entry.targetUserId}`}
                        className="text-accent underline-offset-2 hover:underline"
                      >
                        {entry.targetUserId}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
