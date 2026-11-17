import {
  CANCEL_CUTOFF_HOURS_OPTIONS,
  DEFAULT_BOOKING_LEAD_HOURS,
  DEFAULT_CANCEL_CUTOFF_HOURS,
  isBookingLeadHours,
  isCancelCutoffHours,
  type BookingLeadHours,
  type CancelCutoffHours,
} from "@/lib/booking-constants";
import {
  resolveReminderHours,
  type ResolvedReminderHours,
} from "@/lib/booking-reminder";

export type ResolvedBookingSettings = {
  bookingLeadHours: BookingLeadHours;
  cancelCutoffHours: CancelCutoffHours;
  reminderHours: ResolvedReminderHours;
};

export function resolveBookingLeadHours(
  value: number | null | undefined,
): BookingLeadHours {
  return isBookingLeadHours(value) ? value : DEFAULT_BOOKING_LEAD_HOURS;
}

export function resolveCancelCutoffHours(
  value: number | null | undefined,
  leadHours: BookingLeadHours = DEFAULT_BOOKING_LEAD_HOURS,
): CancelCutoffHours {
  const raw = isCancelCutoffHours(value)
    ? value
    : DEFAULT_CANCEL_CUTOFF_HOURS;
  return raiseCutoffToLead(raw, leadHours);
}

/** Lowest allowed cutoff that is ≥ lead and in the cutoff list. */
export function raiseCutoffToLead(
  cutoffHours: CancelCutoffHours,
  leadHours: BookingLeadHours,
): CancelCutoffHours {
  if (cutoffHours >= leadHours) return cutoffHours;
  const raised = CANCEL_CUTOFF_HOURS_OPTIONS.find((hours) => hours >= leadHours);
  return raised ?? leadHours;
}

/**
 * Apply a settings update.
 * - Raising lead above the current cutoff auto-raises the cutoff (BR-004).
 * - An explicit cutoff below the resulting lead is refused (CUTOFF_TOO_LOW).
 */
export function applyBookingSettingsUpdate(input: {
  currentLead: BookingLeadHours;
  currentCutoff: CancelCutoffHours;
  nextLead: BookingLeadHours;
  nextCutoff: CancelCutoffHours;
}):
  | {
      ok: true;
      bookingLeadHours: BookingLeadHours;
      cancelCutoffHours: CancelCutoffHours;
      cutoffRaised: boolean;
    }
  | { ok: false; error: "CUTOFF_TOO_LOW" } {
  const bookingLeadHours = input.nextLead;

  if (input.nextCutoff < bookingLeadHours) {
    const leadIncreased = bookingLeadHours > input.currentLead;
    if (!leadIncreased) {
      return { ok: false, error: "CUTOFF_TOO_LOW" };
    }
    const cancelCutoffHours = raiseCutoffToLead(
      input.nextCutoff,
      bookingLeadHours,
    );
    return {
      ok: true,
      bookingLeadHours,
      cancelCutoffHours,
      cutoffRaised: true,
    };
  }

  return {
    ok: true,
    bookingLeadHours,
    cancelCutoffHours: input.nextCutoff,
    cutoffRaised: false,
  };
}

export function resolveBookingSettings(user: {
  bookingLeadHours?: number | null;
  cancelCutoffHours?: number | null;
  reminderHours?: number | null;
}): ResolvedBookingSettings {
  const bookingLeadHours = resolveBookingLeadHours(user.bookingLeadHours);
  return {
    bookingLeadHours,
    cancelCutoffHours: resolveCancelCutoffHours(
      user.cancelCutoffHours,
      bookingLeadHours,
    ),
    reminderHours: resolveReminderHours(user.reminderHours),
  };
}
