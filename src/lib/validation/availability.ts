import { z } from "zod";
import { MAX_AVAILABILITY_CHANGES_PER_REQUEST } from "@/lib/booking-constants";

const isoLikeDate = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "invalid_start",
  });

/** Batch body for POST /api/masseur/availability when `changes` is present (#165). */
export const availabilityChangesBatchSchema = z.object({
  changes: z
    .array(
      z.object({
        start: isoLikeDate,
        active: z.boolean(),
      }),
    )
    .max(MAX_AVAILABILITY_CHANGES_PER_REQUEST),
});

export type AvailabilityChangesBatchInput = z.infer<
  typeof availabilityChangesBatchSchema
>;
