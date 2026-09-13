import { z } from "zod";
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

export const bookingCreateSchema = z
  .object({
    masseurId: requiredText(64),
    clientName: requiredText(NAME_MAX),
    clientPhone: phoneSchema,
    note: z
      .string()
      .trim()
      .max(NOTE_MAX)
      .optional()
      .transform((value) => value ?? ""),
    massageType: z.string().trim().optional(),
    slotStarts: z.array(isoLikeDate).optional(),
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
      clientName: value.clientName,
      clientPhone: value.clientPhone,
      note: value.note,
      massageType: value.massageType?.trim() || "",
      slotStarts: starts,
    };
  });

export const bookingCancelSchema = z.union([
  z.object({
    bookingId: requiredText(64),
  }),
  z.object({
    masseurId: requiredText(64),
    slotStart: isoLikeDate,
  }),
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

export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;
export type BookingCancelInput = z.infer<typeof bookingCancelSchema>;
export type MasseurBookingCreateInput = z.infer<typeof masseurBookingCreateSchema>;
