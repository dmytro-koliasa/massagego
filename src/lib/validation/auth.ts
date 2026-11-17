import { z } from "zod";
import {
  canonicalCitySchema,
  localeSchema,
  NAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  passwordSchema,
  phoneSchema,
  portalSchema,
  realEmailSchema,
  emailSchema,
  requiredText,
} from "@/lib/validation/common";

/** Masseur (and legacy) registration with email. */
export const registerSchema = z
  .object({
    name: requiredText(NAME_MAX),
    email: emailSchema,
    password: passwordSchema,
    passwordConfirm: z.string().min(1).max(PASSWORD_MAX),
    preferredLocale: localeSchema.optional(),
    portal: portalSchema.optional(),
    role: portalSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.passwordConfirm) {
      ctx.addIssue({
        code: "custom",
        message: "password_mismatch",
        path: ["passwordConfirm"],
      });
    }
  });

/** Client registration: name + phone + real email + city + password. */
export const clientRegisterSchema = z
  .object({
    name: requiredText(NAME_MAX),
    phone: phoneSchema,
    email: realEmailSchema,
    city: canonicalCitySchema,
    password: passwordSchema,
    passwordConfirm: z.string().min(1).max(PASSWORD_MAX),
    preferredLocale: localeSchema.optional(),
    portal: z.literal("client").optional(),
    role: z.literal("client").optional(),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.passwordConfirm) {
      ctx.addIssue({
        code: "custom",
        message: "password_mismatch",
        path: ["passwordConfirm"],
      });
    }
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(PASSWORD_MIN).max(PASSWORD_MAX),
});

export const clientLoginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(PASSWORD_MIN).max(PASSWORD_MAX),
});

/** Client reset by phone; masseur reset by email. */
export const passwordResetRequestSchema = z.discriminatedUnion("portal", [
  z.object({
    portal: z.literal("client"),
    phone: phoneSchema,
    preferredLocale: localeSchema.optional(),
  }),
  z.object({
    portal: z.literal("masseur"),
    email: emailSchema,
    preferredLocale: localeSchema.optional(),
  }),
]);

export const passwordResetConfirmSchema = z
  .object({
    token: z.string().trim().min(1).max(128),
    password: passwordSchema,
    passwordConfirm: z.string().min(1).max(PASSWORD_MAX),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.passwordConfirm) {
      ctx.addIssue({
        code: "custom",
        message: "password_mismatch",
        path: ["passwordConfirm"],
      });
    }
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type ClientRegisterInput = z.infer<typeof clientRegisterSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ClientLoginInput = z.infer<typeof clientLoginSchema>;
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetConfirmInput = z.infer<typeof passwordResetConfirmSchema>;
