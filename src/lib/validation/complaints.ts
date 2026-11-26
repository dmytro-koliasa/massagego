import { z } from "zod";
import {
  COMPLAINT_ADMIN_NOTE_MAX,
  COMPLAINT_BODY_MAX,
} from "@/lib/complaints-shared";

export const complaintCreateSchema = z.object({
  bookingId: z.string().trim().min(1),
  category: z.enum(["no_show", "rude", "spam", "other"]),
  body: z.string().trim().min(1).max(COMPLAINT_BODY_MAX),
});

export const complaintAdminPatchSchema = z
  .object({
    status: z.enum(["open", "resolved", "dismissed"]).optional(),
    adminNote: z
      .string()
      .trim()
      .max(COMPLAINT_ADMIN_NOTE_MAX)
      .nullable()
      .optional(),
  })
  .refine(
    (value) => value.status !== undefined || value.adminNote !== undefined,
    { message: "empty_patch" },
  );
