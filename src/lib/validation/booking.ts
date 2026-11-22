import { z } from "zod";
import { MAX_ACTIVE_FUTURE_BOOKINGS_PER_CLIENT } from "@/lib/booking-constants";
import {
  CLIENT_CANCEL_REASON_KEYS,
} from "@/lib/client-booking-rules";
import {
  NAME_MAX,
  NOTE_MAX,
  phoneSchema,
  requiredText,
} from "@/lib/validation/common";

const isoLikeDate = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "invalid_slot",
  });

const cancelReasonTextSchema = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((value) => value ?? "");

export const bookingCreateSchema = z
  .object({
    masseurId: requiredText(64),
    // Ignored for client bookings (taken from the account). Kept optional so
    // older clients that still send the fields do not fail validation.
    clientName: z.string().trim().max(NAME_MAX).optional(),
    clientPhone: z.string().trim().optional(),
    note: z
      .string()
      .trim()
      .max(NOTE_MAX)
      .optional()
      .transform((value) => value ?? ""),
    massageType: z.string().trim().optional(),
    // Request-size guard aligned with BR-008 total cap (#164). Product still
    // enforces CLIENT_BOOKING_LIMIT against activeFutureCount + starts.length.
    slotStarts: z
      .array(isoLikeDate)
      .max(MAX_ACTIVE_FUTURE_BOOKINGS_PER_CLIENT)
      .optional(),
    slotStart: isoLikeDate.optional(),
  })
  .superRefine((value, ctx) => {
    const starts =
      value.slotStarts && value.slotStarts.length > 0
        ? value.slotStarts
        : value.slotStart
          ? [value.slotStart]
          : [];

    if (starts.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "missing_fields",
        path: ["slotStarts"],
      });
    }
  })
  .transform((value) => {
    const starts =
      value.slotStarts && value.slotStarts.length > 0
        ? value.slotStarts
        : value.slotStart
          ? [value.slotStart]
          : [];

    return {
      masseurId: value.masseurId,
      note: value.note,
      massageType: value.massageType?.trim() || "",
      slotStarts: starts,
    };
  });

const cancelReasonSchema = z.enum(CLIENT_CANCEL_REASON_KEYS);

const cancelReasonFields = z
  .object({
    cancelReason: cancelReasonSchema,
    cancelReasonText: cancelReasonTextSchema,
  })
  .superRefine((value, ctx) => {
    if (value.cancelReason === "other") {
      if (!value.cancelReasonText) {
        ctx.addIssue({
          code: "custom",
          message: "CANCEL_REASON_REQUIRED",
          path: ["cancelReasonText"],
        });
      }
      return;
    }
    if (value.cancelReasonText) {
      ctx.addIssue({
        code: "custom",
        message: "CANCEL_REASON_REQUIRED",
        path: ["cancelReasonText"],
      });
    }
  });

export const bookingCancelSchema = z.union([
  cancelReasonFields.and(
    z.object({
      bookingId: requiredText(64),
    }),
  ),
  cancelReasonFields.and(
    z.object({
      masseurId: requiredText(64),
      slotStart: isoLikeDate,
    }),
  ),
]);

/** Masseur books a slot on behalf of a walk-in / phone client. */
export const masseurBookingCreateSchema = z.object({
  clientName: requiredText(NAME_MAX),
  clientPhone: phoneSchema,
  slotStart: isoLikeDate,
  note: z
    .string()
    .trim()
    .max(NOTE_MAX)
    .optional()
    .transform((value) => value ?? ""),
  massageType: z.string().trim().optional(),
});

/** Cancel a booking and leave the hour available or free. */
export const masseurBookingResolveSchema = z.object({
  slotStart: isoLikeDate,
  availability: z.enum(["available", "unavailable"]),
});

/** Cancel all future confirmed bookings for the masseur (X-4). */
export const masseurBulkCancelSchema = z.object({
  availability: z.enum(["available", "unavailable"]),
});

export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;
export type BookingCancelInput = z.infer<typeof bookingCancelSchema>;
export type MasseurBookingCreateInput = z.infer<typeof masseurBookingCreateSchema>;
export type MasseurBookingResolveInput = z.infer<typeof masseurBookingResolveSchema>;
export type MasseurBulkCancelInput = z.infer<typeof masseurBulkCancelSchema>;
