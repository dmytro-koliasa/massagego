import { z } from "zod";
import {
  BOOKING_LEAD_HOURS_OPTIONS,
  CANCEL_CUTOFF_HOURS_OPTIONS,
} from "@/lib/booking-constants";
import {
  ADDRESS_MAX,
  CITY_MAX,
  DESCRIPTION_MAX,
  NAME_MAX,
  nullableText,
  requiredText,
} from "@/lib/validation/common";
import { isMassageTypeValue } from "@/lib/massage-types";

const bookingLeadHoursSchema = z
  .number()
  .int()
  .refine(
    (value) => (BOOKING_LEAD_HOURS_OPTIONS as readonly number[]).includes(value),
    { message: "invalid_booking_lead_hours" },
  );

const cancelCutoffHoursSchema = z
  .number()
  .int()
  .refine(
    (value) =>
      (CANCEL_CUTOFF_HOURS_OPTIONS as readonly number[]).includes(value),
    { message: "invalid_cancel_cutoff_hours" },
  );

export const masseurProfileSchema = z.object({
  nameEn: nullableText(NAME_MAX),
  nameUk: nullableText(NAME_MAX),
  descriptionEn: nullableText(DESCRIPTION_MAX),
  descriptionUk: nullableText(DESCRIPTION_MAX),
  city: requiredText(CITY_MAX),
  address: requiredText(ADDRESS_MAX),
  massageTypes: z
    .array(z.string())
    .optional()
    .refine(
      (value) =>
        value === undefined || value.every((item) => isMassageTypeValue(item)),
      { message: "invalid_massage_type" },
    ),
});

/** Dedicated save for lead time / cancellation cutoff (BR-002, BR-004). */
export const masseurBookingSettingsSchema = z.object({
  bookingLeadHours: bookingLeadHoursSchema,
  cancelCutoffHours: cancelCutoffHoursSchema,
});

export const clientProfileSchema = z.object({
  nameEn: nullableText(NAME_MAX),
  nameUk: nullableText(NAME_MAX),
});

export type MasseurProfileInput = z.infer<typeof masseurProfileSchema>;
export type ClientProfileInput = z.infer<typeof clientProfileSchema>;
