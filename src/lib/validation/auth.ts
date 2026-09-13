import { z } from 'zod';
import {
	emailSchema,
	NAME_MAX,
	PASSWORD_MAX,
	PASSWORD_MIN,
	passwordSchema,
	portalSchema,
	requiredText,
} from '@/lib/validation/common';

export const registerSchema = z.object({
	name: requiredText(NAME_MAX),
	email: emailSchema,
	password: passwordSchema,
	portal: portalSchema.optional(),
	role: portalSchema.optional(),
});

export const loginSchema = z.object({
	email: emailSchema,
	password: z.string().min(PASSWORD_MIN).max(PASSWORD_MAX),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
