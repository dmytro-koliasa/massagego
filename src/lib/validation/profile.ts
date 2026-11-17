import { z } from "zod";
import {
  BOOKING_LEAD_HOURS_OPTIONS,
  CANCEL_CUTOFF_HOURS_OPTIONS,
} from "@/lib/booking-constants";
import { isMassageTypeValue } from "@/lib/massage-types";
import {
  ADDRESS_MAX,
  canonicalCitySchema,
  DESCRIPTION_MAX,
  localeSchema,
  NAME_MAX,
  nullableText,
  phoneSchema,
  realEmailSchema,
  requiredText,
  timeZoneSchema,
} from "@/lib/validation/common";

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
  city: canonicalCitySchema,
  address: requiredText(ADDRESS_MAX),
  phone: phoneSchema,
  timezone: timeZoneSchema,
  preferredLocale: localeSchema.optional(),
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
  email: realEmailSchema.optional(),
  city: canonicalCitySchema.optional(),
  preferredLocale: localeSchema.optional(),
});

export type MasseurProfileInput = z.infer<typeof masseurProfileSchema>;
export type ClientProfileInput = z.infer<typeof clientProfileSchema>;
