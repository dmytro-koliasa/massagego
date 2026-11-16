import { SLOT_MS } from "@/lib/booking-constants";

/** True while the client may still cancel: `now <= slotStart - cutoffHours` (BR-004). */
export function isWithinClientCancelWindow(
  slotStart: Date,
  cutoffHours: number,
  now: Date = new Date(),
): boolean {
  const cutoffMs = cutoffHours * 60 * 60 * 1000;
  return now.getTime() <= slotStart.getTime() - cutoffMs;
}

/** True when a booking made now could not later be cancelled in the app. */
export function isNonCancellableAtBookingTime(
  slotStart: Date,
  cutoffHours: number,
  now: Date = new Date(),
): boolean {
  return !isWithinClientCancelWindow(slotStart, cutoffHours, now);
}

/** Adjacent hour starts (±1 session) for Thai neighbour detection (X-1). */
export function neighbouringSlotStarts(slotStart: Date): Date[] {
  return [
    new Date(slotStart.getTime() - SLOT_MS),
    new Date(slotStart.getTime() + SLOT_MS),
  ];
}

export const CLIENT_CANCEL_REASON_KEYS = [
  "cant_make_it",
  "circumstances_changed",
  "changed_mind",
  "wrong_slot",
  "other",
] as const;

export type ClientCancelReasonKey = (typeof CLIENT_CANCEL_REASON_KEYS)[number];

export function isClientCancelReasonKey(
  value: unknown,
): value is ClientCancelReasonKey {
  return (
    typeof value === "string" &&
    (CLIENT_CANCEL_REASON_KEYS as readonly string[]).includes(value)
  );
}
