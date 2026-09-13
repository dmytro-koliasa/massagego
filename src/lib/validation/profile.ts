import { z } from "zod";
import {
  ADDRESS_MAX,
  CITY_MAX,
  DESCRIPTION_MAX,
  NAME_MAX,
  nullableText,
  requiredText,
} from "@/lib/validation/common";
import { isMassageTypeValue } from "@/lib/massage-types";

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

export const clientProfileSchema = z.object({
  nameEn: nullableText(NAME_MAX),
  nameUk: nullableText(NAME_MAX),
});

export type MasseurProfileInput = z.infer<typeof masseurProfileSchema>;
export type ClientProfileInput = z.infer<typeof clientProfileSchema>;
