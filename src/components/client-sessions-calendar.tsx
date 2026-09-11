"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import ukLocale from "@fullcalendar/core/locales/uk";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { getMassageTypeLabel } from "@/lib/massage-types";

type ClientSession = {
  id: string;
  start: string;
  end: string;
  massageType: string | null;
  masseur: {
    id: string;
    name: string | null;
    nameEn: string | null;
    nameUk: string | null;
  };
};

type CancelTarget = {
  bookingId: string;
  startIso: string;
  label: string;
  massageTypeLabel: string | null;
};

const SLOT_MS = 60 * 60 * 1000;

function getMonthName(date: Date, locale: "en" | "uk") {
  const localeTag = locale === "uk" ? "uk-UA" : "en-GB";

  if (locale === "uk") {
    return (
      new Intl.DateTimeFormat(localeTag, {
        day: "numeric",
        month: "long",
      })
        .formatToParts(date)
        .find((part) => part.type === "month")?.value ?? ""
    );
  }

  return new Intl.DateTimeFormat(localeTag, {
    month: "long",
  }).format(date);
}

function formatWeekTitle(fromIso: string, toIso: string, locale: "en" | "uk") {
  const start = new Date(fromIso);
  const end = new Date(new Date(toIso).getTime() - 1);

  const sameMonth =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth();

  if (sameMonth) {
    const month = getMonthName(start, locale);
    return `${start.getDate()} – ${end.getDate()} ${month} ${start.getFullYear()}`;
  }

  const startMonth = getMonthName(start, locale);
  const endMonth = getMonthName(end, locale);

  if (start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()} ${startMonth} – ${end.getDate()} ${endMonth} ${start.getFullYear()}`;
  }

  return `${start.getDate()} ${startMonth} ${start.getFullYear()} – ${end.getDate()} ${endMonth} ${end.getFullYear()}`;
}

function formatSessionSlot(startIso: string, locale: "en" | "uk") {
  const start = new Date(startIso);
  const end = new Date(start.getTime() + SLOT_MS);
  const localeTag = locale === "uk" ? "uk-UA" : "en-GB";

  const datePart = new Intl.DateTimeFormat(localeTag, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(start);

  const timeFormatter = new Intl.DateTimeFormat(localeTag, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `${datePart}, ${timeFormatter.format(start)}-${timeFormatter.format(end)}`;
}

function formatHourRange(start: Date, end: Date, locale: "en" | "uk") {
  const localeTag = locale === "uk" ? "uk-UA" : "en-GB";
  const formatter = new Intl.DateTimeFormat(localeTag, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return {
    start: formatter.format(start),
    end: formatter.format(end),
  };
}

function fillTimeHint(template: string, start: string, end: string) {
  return template.replaceAll("{start}", start).replaceAll("{end}", end);
}

export function ClientSessionsCalendar() {
  const { t, locale } = useLanguage();
  const calendarRef = useRef<FullCalendar | null>(null);
  const [sessions, setSessions] = useState<ClientSession[]>([]);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);
  const [hoverTip, setHoverTip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  const showSlotTip = useCallback((text: string, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    setHoverTip({
      text,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  }, []);

  const hideSlotTip = useCallback(() => {
    setHoverTip(null);
  }, []);

  const showSlotTipRef = useRef(showSlotTip);
  showSlotTipRef.current = showSlotTip;
  const hideSlotTipRef = useRef(hideSlotTip);
  hideSlotTipRef.current = hideSlotTip;

  const viewTitle = useMemo(() => {
    if (!range) return "";
    return formatWeekTitle(range.from, range.to, locale);
  }, [range, locale]);

  const isCurrentWeek = useMemo(() => {
    if (!range) return false;
    const now = Date.now();
    return (
      now >= new Date(range.from).getTime() &&
      now < new Date(range.to).getTime()
    );
  }, [range]);

  const events = useMemo(
    () =>
      sessions.map((session) => {
        const masseurName =
          (locale === "uk"
            ? session.masseur.nameUk
            : session.masseur.nameEn
          )?.trim() ||
          session.masseur.name?.trim() ||
          t.masseurFallbackName;
        const hours = formatHourRange(
          new Date(session.start),
          new Date(session.end),
          locale,
        );
        const massageTypeLabel = session.massageType
          ? getMassageTypeLabel(session.massageType, locale)
          : null;
        const baseHint = fillTimeHint(
          t.bookingBookedSlotHint,
          hours.start,
          hours.end,
        );
        const [timeLine, ...restHint] = baseHint.split("\n");
        const hint = [
          timeLine,
          masseurName,
          massageTypeLabel
            ? `${t.bookingMassageType}: ${massageTypeLabel}`
            : null,
          ...restHint,
        ]
          .filter(Boolean)
          .join("\n");

        return {
          id: session.id,
          start: session.start,
          end: session.end,
          title: masseurName,
          display: "block" as const,
          classNames: ["fc-event-booked", "fc-event-booked-mine"],
          borderColor: "transparent",
          editable: false,
          extendedProps: {
            bookingId: session.id,
            startIso: session.start,
            masseurName,
            massageType: session.massageType,
            hint,
          },
        };
      }),
    [
      sessions,
      locale,
      t.masseurFallbackName,
      t.bookingBookedSlotHint,
      t.bookingMassageType,
    ],
  );

  const loadSessions = useCallback(
    async (from: string, to: string) => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/bookings?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          toast.error(
            response.status === 401 || response.status === 403
              ? t.bookingUnauthorized
              : t.clientSessionsLoadError,
          );
          return;
        }
        const data = (await response.json()) as { bookings?: ClientSession[] };
        setSessions(data.bookings ?? []);
      } catch {
        toast.error(t.clientSessionsLoadError);
      } finally {
        setLoading(false);
      }
    },
    [t.bookingUnauthorized, t.clientSessionsLoadError],
  );

  useEffect(() => {
    if (!range) return;
    void loadSessions(range.from, range.to);
  }, [range, loadSessions]);

  function requestCancel(session: {
    bookingId: string;
    startIso: string;
    masseurName: string;
    massageType: string | null;
  }) {
    if (cancelPending) return;
    hideSlotTip();
    setCancelTarget({
      bookingId: session.bookingId,
      startIso: session.startIso,
      label: `${session.masseurName} · ${formatSessionSlot(session.startIso, locale)}`,
      massageTypeLabel: session.massageType
        ? getMassageTypeLabel(session.massageType, locale)
        : null,
    });
  }

  function closeCancelDialog() {
    if (cancelPending) return;
    setCancelTarget(null);
  }

  async function confirmCancelBooking() {
    if (!cancelTarget || cancelPending) return;

    setCancelPending(true);
    try {
      const response = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: cancelTarget.bookingId }),
      });

      if (!response.ok) {
        toast.error(
          response.status === 403
            ? t.bookingCancelForbidden
            : t.bookingCancelError,
        );
        return;
      }

      toast.success(t.bookingCancelSuccess);
      setCancelTarget(null);
      if (range) {
        await loadSessions(range.from, range.to);
      }
    } catch {
      toast.error(t.bookingCancelError);
    } finally {
      setCancelPending(false);
    }
  }

  function goToPrev() {
    calendarRef.current?.getApi().prev();
  }

  function goToNext() {
    calendarRef.current?.getApi().next();
  }

  function goToToday() {
    calendarRef.current?.getApi().today();
  }

  return (
    <div className="text-left">
      <div className={`AvailabilityCalendar ${loading ? "opacity-80" : ""}`}>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={goToPrev}
              className="AvailabilityCalendarNavBtn"
              aria-label="Previous week"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={goToNext}
              className="AvailabilityCalendarNavBtn"
              aria-label="Next week"
            >
              ›
            </button>
            <button
              type="button"
              onClick={goToToday}
              disabled={isCurrentWeek}
              className="AvailabilityCalendarNavBtn AvailabilityCalendarNavBtnWide disabled:cursor-not-allowed disabled:opacity-45"
            >
              {t.availabilityToday}
            </button>
          </div>

          <h4 className="pt-1 text-base font-bold text-foreground sm:text-lg">
            {viewTitle}
          </h4>
        </div>

        <FullCalendar
          key={locale}
          ref={calendarRef}
          plugins={[timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          locale={locale === "uk" ? ukLocale : "en"}
          headerToolbar={false}
          allDaySlot={false}
          slotMinTime="05:00:00"
          slotMaxTime="23:00:00"
          slotDuration="01:00:00"
          slotLabelInterval="01:00:00"
          slotLabelFormat={{
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }}
          snapDuration="01:00:00"
          height="auto"
          expandRows
          nowIndicator
          selectable={false}
          editable={false}
          eventStartEditable={false}
          eventDurationEditable={false}
          events={events}
          eventDidMount={(info) => {
            const hint = info.event.extendedProps.hint;
            if (typeof hint !== "string" || !hint) return;

            const onEnter = () => showSlotTipRef.current(hint, info.el);
            const onLeave = () => hideSlotTipRef.current();
            info.el.addEventListener("mouseenter", onEnter);
            info.el.addEventListener("mouseleave", onLeave);
          }}
          datesSet={(arg) => {
            hideSlotTip();
            setRange({
              from: arg.start.toISOString(),
              to: arg.end.toISOString(),
            });
          }}
          eventClick={(arg) => {
            const props = arg.event.extendedProps;
            if (
              typeof props.bookingId !== "string" ||
              typeof props.startIso !== "string" ||
              typeof props.masseurName !== "string"
            ) {
              return;
            }
            requestCancel({
              bookingId: props.bookingId,
              startIso: props.startIso,
              masseurName: props.masseurName,
              massageType:
                typeof props.massageType === "string"
                  ? props.massageType
                  : null,
            });
          }}
          eventTextColor="#ffffff"
          slotEventOverlap={false}
          firstDay={1}
        />
      </div>

      {hoverTip ? (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-[80] max-w-xs -translate-x-1/2 -translate-y-full whitespace-pre-line rounded-lg border border-surface-border bg-background px-3 py-2 text-left text-xs leading-relaxed text-foreground shadow-[0_12px_30px_rgba(0,0,0,0.16)]"
          style={{ left: hoverTip.x, top: hoverTip.y - 8 }}
        >
          {hoverTip.text}
        </div>
      ) : null}

      {cancelTarget ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 p-4"
          role="presentation"
          onClick={closeCancelDialog}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="client-session-cancel-title"
            className="w-full max-w-sm rounded-xl border border-surface-border bg-background p-5 shadow-[0_24px_60px_rgba(0,0,0,0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <p
              id="client-session-cancel-title"
              className="text-base font-medium text-foreground"
            >
              {t.bookingCancelConfirm}
            </p>
            <p className="mt-2 text-sm text-muted">{cancelTarget.label}</p>
            {cancelTarget.massageTypeLabel ? (
              <p className="mt-1 text-sm text-muted">
                {t.bookingMassageType}: {cancelTarget.massageTypeLabel}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={cancelPending}
                onClick={closeCancelDialog}
                className="h-11 rounded-lg border border-surface-border px-4 text-sm font-medium text-foreground transition hover:border-accent/40 disabled:opacity-60"
              >
                {t.bookingCancelKeep}
              </button>
              <button
                type="button"
                disabled={cancelPending}
                onClick={() => void confirmCancelBooking()}
                className="h-11 rounded-lg bg-accent px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {cancelPending
                  ? t.authPleaseWait
                  : t.bookingCancelConfirmAction}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
