import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { forgotPasswordSchema, type ForgotPasswordFormData } from '@/schemas/authSchemas';
import { useForgotPasswordMutation } from '@/store/api/authApi';
import { MESSAGES } from '@/constants/messages';

/**
 * ForgotPasswordForm Props
 */
interface ForgotPasswordFormProps {
  onBack: () => void;
  onSuccess?: () => void;
}

/**
 * ForgotPasswordForm Component
 * Simple password reset form with email validation
 * Arrow function as per CLAUDE.md conventions
 *
 * Features:
 * - react-hook-form with Zod validation
 * - Email field with validation
 * - Loading states
 * - Success/error toast notifications
 * - Back to login navigation
 * - Framer Motion entrance animation
 */
export const ForgotPasswordForm = ({ onBack, onSuccess }: ForgotPasswordFormProps) => {
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      const result = await forgotPassword(data).unwrap();

      // Show success notification
      toast.success(result.message || MESSAGES.SUCCESS_RESET_LINK_SENT);

      // Reset form
      reset();

      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }

      // Return to login after 2 seconds
      setTimeout(() => {
        onBack();
      }, 2000);
    } catch (error) {
      // Handle error
      const errorMessage =
        (error as { data?: { message?: string } })?.data?.message ||
        MESSAGES.ERROR_RESET_LINK_FAILED;
      toast.error(errorMessage);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4"
    >
      {/* Email Field */}
      <div className="space-y-2">
        <Label htmlFor="email">
          {MESSAGES.EMAIL_LABEL}
          <span className="ml-1 text-red-500">{MESSAGES.REQUIRED_FIELD_INDICATOR}</span>
        </Label>
        <Input
          id="email"
          type="email"
          placeholder={MESSAGES.EMAIL_PLACEHOLDER}
          {...register('email')}
          className={errors.email ? 'border-red-500' : ''}
          disabled={isLoading}
          autoFocus
        />
        {errors.email && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-red-500"
          >
            {errors.email.message}
          </motion.p>
        )}
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isLoading}
          className="flex-1"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {MESSAGES.BACK_TO_LOGIN}
        </Button>

        <Button type="submit" className="flex-1" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {MESSAGES.LOADING_SENDING}
            </>
          ) : (
            MESSAGES.SEND_RESET_LINK
          )}
        </Button>
      </div>
    </motion.form>
  );
};
