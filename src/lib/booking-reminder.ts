import {
  DEFAULT_REMINDER_HOURS,
  isReminderHours,
  type ReminderHours,
} from "@/lib/booking-constants";

/** `null` means reminders are Off for this masseur. */
export type ResolvedReminderHours = ReminderHours | null;

/**
 * Resolve masseur reminder setting.
 * - `null` → Off
 * - missing/invalid → default 24
 */
export function resolveReminderHours(
  value: number | null | undefined,
): ResolvedReminderHours {
  if (value === null) return null;
  if (value === undefined) return DEFAULT_REMINDER_HOURS;
  return isReminderHours(value) ? value : DEFAULT_REMINDER_HOURS;
}

export type ReminderEligibilityInput = {
  now: Date;
  slotStart: Date;
  createdAt: Date;
  reminderHours: ResolvedReminderHours;
  reminderSentAt: Date | null;
  status: string;
  clientUserId: string | null;
};

/**
 * Whether a booking should receive a client reminder at `now`.
 * Window: [slotStart − H, slotStart). Skip if booked inside the window.
 */
export function isBookingDueForReminder(
  input: ReminderEligibilityInput,
): boolean {
  if (input.reminderHours === null) return false;
  if (input.reminderSentAt) return false;
  if (input.status !== "confirmed") return false;
  if (!input.clientUserId) return false;

  const slotMs = input.slotStart.getTime();
  const nowMs = input.now.getTime();
  if (!(nowMs < slotMs)) return false;

  const windowStartMs = slotMs - input.reminderHours * 60 * 60 * 1000;
  if (nowMs < windowStartMs) return false;

  // Booked already inside the reminder window → do not send.
  if (input.createdAt.getTime() >= windowStartMs) return false;

  return true;
}
