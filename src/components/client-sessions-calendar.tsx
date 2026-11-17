"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import ukLocale from "@fullcalendar/core/locales/uk";
import { toast } from "sonner";
import {
  CancelBookingDialog,
  cutoffPassedMessage,
  thaiNeighborCutoffMessage,
} from "@/components/cancel-booking-dialog";
import { useLanguage } from "@/components/language-provider";
import { showPersistentThaiHint } from "@/lib/thai-hints";
import {
  CALENDAR_SLOT_DURATION,
  CALENDAR_SLOT_MAX_TIME,
  CALENDAR_SLOT_MIN_TIME,
  DEFAULT_CANCEL_CUTOFF_HOURS,
  DEFAULT_MASSEUR_TIME_ZONE,
} from "@/lib/booking-constants";
import {
  formatHourRange,
  formatSlotDateTime,
  formatWeekTitle,
} from "@/lib/calendar-time";
import {
  isWithinClientCancelWindow,
  type ClientCancelReasonKey,
} from "@/lib/client-booking-rules";
import { resolveTimeZone, timeZoneLabel } from "@/lib/masseur-time";
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
    timezone: string;
    phone?: string | null;
    cancelCutoffHours?: number;
  };
};

type CancelTarget = {
  bookingId: string;
  startIso: string;
  timeZone: string;
  massageType: string | null;
  masseurPhone: string | null;
};

function fillTimeHint(template: string, start: string, end: string) {
  return template.replaceAll("{start}", start).replaceAll("{end}", end);
}

function browserTimeZone() {
  return (
    Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_MASSEUR_TIME_ZONE
  );
}

export function ClientSessionsCalendar() {
  const { t, locale } = useLanguage();
  const calendarRef = useRef<FullCalendar | null>(null);
  const [sessions, setSessions] = useState<ClientSession[]>([]);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const localZone = browserTimeZone();
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
    return formatWeekTitle(range.from, range.to, locale, localZone);
  }, [range, locale, localZone]);

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
        const zone = resolveTimeZone(session.masseur.timezone);
        const zoneLabel = timeZoneLabel(zone, new Date(session.start));
        const hours = formatHourRange(
          new Date(session.start),
          new Date(session.end),
          locale,
          zone,
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
          `${timeLine} (${zoneLabel})`,
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
          title: `${masseurName} · ${zoneLabel}`,
          display: "block" as const,
          classNames: ["fc-event-booked", "fc-event-booked-mine"],
          borderColor: "transparent",
          editable: false,
          extendedProps: {
            bookingId: session.id,
            startIso: session.start,
            masseurName,
            masseurTimeZone: zone,
            massageType: session.massageType,
            masseurPhone: session.masseur.phone?.trim() || null,
            cancelCutoffHours:
              session.masseur.cancelCutoffHours ?? DEFAULT_CANCEL_CUTOFF_HOURS,
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
        setSessions(
          (data.bookings ?? []).map((booking) => ({
            ...booking,
            masseur: {
              ...booking.masseur,
              timezone: resolveTimeZone(booking.masseur?.timezone),
            },
          })),
        );
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
    masseurTimeZone: string;
    massageType: string | null;
    masseurPhone: string | null;
    cancelCutoffHours: number;
  }) {
    if (cancelPending) return;
    hideSlotTip();
    const zone = resolveTimeZone(session.masseurTimeZone);
    if (
      !isWithinClientCancelWindow(
        new Date(session.startIso),
        session.cancelCutoffHours,
      )
    ) {
      toast.error(cutoffPassedMessage(session.masseurPhone, t));
      return;
    }
    setCancelTarget({
      bookingId: session.bookingId,
      startIso: session.startIso,
      timeZone: zone,
      massageType: session.massageType,
      masseurPhone: session.masseurPhone,
    });
  }

  function closeCancelDialog() {
    if (cancelPending) return;
    setCancelTarget(null);
  }

  async function confirmCancelBooking(input: {
    cancelReason: ClientCancelReasonKey;
    cancelReasonText: string;
  }) {
    if (!cancelTarget || cancelPending) return;

    setCancelPending(true);
    try {
      const response = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: cancelTarget.bookingId,
          cancelReason: input.cancelReason,
          cancelReasonText: input.cancelReasonText || undefined,
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
        masseurPhone?: string | null;
        neighborHint?: {
          type: string;
          masseurPhone?: string | null;
        };
      } | null;

      if (!response.ok) {
        if (data?.error === "CANCEL_CUTOFF_PASSED") {
          toast.error(
            cutoffPassedMessage(
              data.masseurPhone ?? cancelTarget.masseurPhone,
              t,
            ),
          );
        } else if (data?.error === "CANCEL_REASON_REQUIRED") {
          toast.error(t.bookingCancelReasonRequired);
        } else if (response.status === 404) {
          toast.error(t.bookingCancelForbidden);
        } else {
          toast.error(t.bookingCancelError);
        }
        return;
      }

      toast.success(t.bookingCancelSuccess);
      if (data?.neighborHint?.type === "thai_cutoff") {
        showPersistentThaiHint(
          thaiNeighborCutoffMessage(
            data.neighborHint.masseurPhone ?? cancelTarget.masseurPhone,
            t,
          ),
        );
      } else if (data?.neighborHint?.type === "thai_neighbor") {
        showPersistentThaiHint(t.bookingThaiCancelNeighborHint);
      }
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
      <div
        className={`AvailabilityCalendar AvailabilityCalendar--noEmptyHover ${loading ? "opacity-80" : ""}`}
      >
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
          slotMinTime={CALENDAR_SLOT_MIN_TIME}
          slotMaxTime={CALENDAR_SLOT_MAX_TIME}
          slotDuration={CALENDAR_SLOT_DURATION}
          slotLabelInterval={CALENDAR_SLOT_DURATION}
          slotLabelFormat={{
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }}
          snapDuration={CALENDAR_SLOT_DURATION}
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
              typeof props.startIso !== "string"
            ) {
              return;
            }
            requestCancel({
              bookingId: props.bookingId,
              startIso: props.startIso,
              masseurTimeZone:
                typeof props.masseurTimeZone === "string"
                  ? props.masseurTimeZone
                  : DEFAULT_MASSEUR_TIME_ZONE,
              massageType:
                typeof props.massageType === "string"
                  ? props.massageType
                  : null,
              masseurPhone:
                typeof props.masseurPhone === "string"
                  ? props.masseurPhone
                  : null,
              cancelCutoffHours:
                typeof props.cancelCutoffHours === "number"
                  ? props.cancelCutoffHours
                  : DEFAULT_CANCEL_CUTOFF_HOURS,
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
        <CancelBookingDialog
          startIso={cancelTarget.startIso}
          timeZone={cancelTarget.timeZone}
          massageType={cancelTarget.massageType}
          pending={cancelPending}
          onClose={closeCancelDialog}
          onConfirm={(input) => void confirmCancelBooking(input)}
        />
      ) : null}
    </div>
  );
}
