import { z } from "zod";
import {
  emailSchema,
  NAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  passwordSchema,
  phoneSchema,
  portalSchema,
  requiredText,
} from "@/lib/validation/common";

/** Masseur (and legacy) registration with email. */
export const registerSchema = z
  .object({
    name: requiredText(NAME_MAX),
    email: emailSchema,
    password: passwordSchema,
    passwordConfirm: z.string().min(1).max(PASSWORD_MAX),
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

/** Client registration: name + phone + password (+ confirm). */
export const clientRegisterSchema = z
  .object({
    name: requiredText(NAME_MAX),
    phone: phoneSchema,
    password: passwordSchema,
    passwordConfirm: z.string().min(1).max(PASSWORD_MAX),
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

export type RegisterInput = z.infer<typeof registerSchema>;
export type ClientRegisterInput = z.infer<typeof clientRegisterSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ClientLoginInput = z.infer<typeof clientLoginSchema>;
