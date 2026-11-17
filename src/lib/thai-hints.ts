import { toast } from "sonner";
import { SLOT_MS } from "@/lib/booking-constants";

export const THAI_MASSAGE_TYPE = "thai";

export const THAI_HINT_TOAST_ID = "thai-massage-hint";

/** True when at least two selected starts form an adjacent hour pair. */
export function hasConsecutiveHourPair(starts: Iterable<string | Date>): boolean {
  const times = [...starts]
    .map((start) =>
      start instanceof Date ? start.getTime() : new Date(start).getTime(),
    )
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => a - b);

  for (let i = 1; i < times.length; i += 1) {
    if (times[i] - times[i - 1] === SLOT_MS) return true;
  }
  return false;
}

/** Persistent toast: stays until the user closes it (BR-014). */
export function showPersistentThaiHint(message: string) {
  toast.message(message, {
    id: THAI_HINT_TOAST_ID,
    duration: Infinity,
    closeButton: true,
  });
}
