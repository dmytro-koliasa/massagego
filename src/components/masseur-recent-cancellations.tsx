"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { Preloader } from "@/components/preloader";
import { formatSlotDateTime } from "@/lib/calendar-time";
import { displayBookingClientName } from "@/lib/deleted-user";
import { resolveTimeZone } from "@/lib/masseur-time";
import type { RecentCancellationDto } from "@/lib/last-cancellation";

type Props = {
  timeZone?: string | null;
};

export function MasseurRecentCancellations({ timeZone }: Props) {
  const { t, locale } = useLanguage();
  const [rows, setRows] = useState<RecentCancellationDto[] | null>(null);
  const [loading, setLoading] = useState(true);
  const zone = resolveTimeZone(timeZone);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/masseur/cancellations", {
        cache: "no-store",
      });
      if (!response.ok) {
        toast.error(t.recentCancellationsLoadError);
        setRows([]);
        return;
      }
      const data = (await response.json()) as {
        cancellations?: RecentCancellationDto[];
      };
      setRows(data.cancellations ?? []);
    } catch {
      toast.error(t.recentCancellationsLoadError);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [t.recentCancellationsLoadError]);

  useEffect(() => {
    void load();
  }, [load]);

  function reasonLabel(row: RecentCancellationDto) {
    const key = `cancelReason_${row.reason}` as keyof typeof t;
    const label =
      typeof t[key] === "string" ? (t[key] as string) : row.reason;
    if (row.reason === "other" && row.reasonText?.trim()) {
      return `${label}: ${row.reasonText.trim()}`;
    }
    return label;
  }

  return (
    <section className="mt-10 rounded-2xl border border-surface-border bg-surface p-6 sm:p-8">
      <div className="mb-4 text-left">
        <h2 className="text-xl font-bold tracking-[-0.02em] text-foreground">
          {t.recentCancellationsTitle}
        </h2>
        <p className="mt-2 text-sm text-muted">{t.recentCancellationsSupport}</p>
      </div>

      {loading ? (
        <Preloader />
      ) : !rows || rows.length === 0 ? (
        <p className="text-sm text-muted">{t.recentCancellationsEmpty}</p>
      ) : (
        <ul className="divide-y divide-surface-border">
          {rows.map((row) => (
            <li key={row.id} className="py-3 text-left first:pt-0 last:pb-0">
              <p className="text-sm font-medium text-foreground">
                {formatSlotDateTime(row.slotStart, locale, zone)}
              </p>
              <p className="mt-0.5 text-sm text-muted">
                {displayBookingClientName(
                  row.clientName,
                  locale === "uk" ? "uk" : "en",
                )}
                {" · "}
                {reasonLabel(row)}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {t.recentCancellationsCancelledAt.replaceAll(
                  "{when}",
                  new Intl.DateTimeFormat(
                    locale === "uk" ? "uk-UA" : "en-GB",
                    {
                      timeZone: zone,
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    },
                  ).format(new Date(row.cancelledAt)),
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
