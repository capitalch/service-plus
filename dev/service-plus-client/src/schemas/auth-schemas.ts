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
    .superRefine((val, ctx) => {
      if (val.includes('@')) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
          ctx.addIssue({ code: 'custom', message: MESSAGES.ERROR_EMAIL_INVALID_FORMAT });
        }
      } else {
        if (val.length < 5) {
          ctx.addIssue({ code: 'custom', message: MESSAGES.ERROR_USERNAME_MIN_LENGTH });
        } else if (!/^[a-zA-Z0-9]+$/.test(val)) {
          ctx.addIssue({ code: 'custom', message: MESSAGES.ERROR_USERNAME_INVALID_FORMAT });
        }
      }
    }),
  password: z
    .string()
    .min(1, MESSAGES.ERROR_PASSWORD_REQUIRED)
    .min(6, MESSAGES.ERROR_PASSWORD_MIN_LENGTH)
    .refine((val) => /[a-zA-Z]/.test(val), { message: MESSAGES.ERROR_PASSWORD_LETTER_REQUIRED })
    .refine((val) => /[0-9]/.test(val), { message: MESSAGES.ERROR_PASSWORD_NUMBER_REQUIRED }),
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
