import { z } from 'zod';
import { MESSAGES } from '@/constants/messages';

/**
 * Login Form Validation Schema
 * Validates client selection, email/username, and password
 */
export const loginSchema = z.object({
  clientId: z.string().min(1, MESSAGES.ERROR_CLIENT_REQUIRED),
  emailOrUsername: z
    .string()
    .min(1, MESSAGES.ERROR_EMAIL_OR_USERNAME_REQUIRED)
    .min(3, MESSAGES.ERROR_EMAIL_OR_USERNAME_MIN_LENGTH),
  password: z
    .string()
    .min(1, MESSAGES.ERROR_PASSWORD_REQUIRED)
    .min(6, MESSAGES.ERROR_PASSWORD_MIN_LENGTH),
});

/**
 * Forgot Password Form Validation Schema
 * Validates email format using custom regex refinement (Zod v4 compatible)
 */
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, MESSAGES.ERROR_EMAIL_REQUIRED)
    .refine(
      (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      { message: MESSAGES.ERROR_EMAIL_INVALID }
    ),
});

/**
 * TypeScript types inferred from schemas
 */
export type LoginFormData = z.infer<typeof loginSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
