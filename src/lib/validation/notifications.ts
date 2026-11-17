import { z } from "zod";
import { NOTIFICATION_EVENT_TYPES } from "@/lib/notifications/types";

export const notificationPreferencesPatchSchema = z.object({
  preferences: z
    .array(
      z
        .object({
          eventType: z.enum(NOTIFICATION_EVENT_TYPES),
          emailEnabled: z.boolean().optional(),
          telegramEnabled: z.boolean().optional(),
        })
        .refine(
          (row) =>
            row.emailEnabled !== undefined || row.telegramEnabled !== undefined,
          { message: "empty_patch" },
        ),
    )
    .min(1)
    .max(NOTIFICATION_EVENT_TYPES.length),
});
