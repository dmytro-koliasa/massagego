import { DateTime } from "luxon";
import {
  CANCELLED_BOOKING_RETENTION_DAYS,
  COMPLETED_BOOKING_RETENTION_MONTHS,
} from "@/lib/booking-constants";

export function cancelledBookingEligibleBefore(now = new Date()): Date {
  return DateTime.fromJSDate(now, { zone: "utc" })
    .minus({ days: CANCELLED_BOOKING_RETENTION_DAYS })
    .toJSDate();
}

export function completedBookingEligibleBefore(now = new Date()): Date {
  return DateTime.fromJSDate(now, { zone: "utc" })
    .minus({ months: COMPLETED_BOOKING_RETENTION_MONTHS })
    .toJSDate();
}
