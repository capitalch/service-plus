import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { forgotPasswordSchema, type ForgotPasswordFormData } from '@/schemas/auth-schemas';
import { forgotPasswordRequest } from '@/store/api/auth-api';
import type { ApiError } from '@/store/api/auth-api';
import { MESSAGES } from '@/constants/messages';

type ForgotPasswordFormProps = {
  onBack: () => void;
  onSuccess?: () => void;
};

export const ForgotPasswordForm = ({ onBack, onSuccess }: ForgotPasswordFormProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      setIsLoading(true);
      const result = await forgotPasswordRequest(data);

      toast.success(result.message || MESSAGES.SUCCESS_RESET_LINK_SENT);
      reset();

      if (onSuccess) onSuccess();

      setTimeout(() => {
        onBack();
      }, 2000);
    } catch (error) {
      const errorMessage = (error as ApiError)?.message || MESSAGES.ERROR_RESET_LINK_FAILED;
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.25 }}
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-5"
    >
        {/* Email Field */}
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium text-slate-700">
            Email
            <span className="ml-0.5 text-red-500">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="Enter your email address"
            {...register('email')}
            aria-invalid={!!errors.email}
            className="h-10"
            disabled={isLoading}
            autoFocus
          />
          {errors.email && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-red-500"
            >
              {errors.email.message}
            </motion.p>
          )}
        </div>

        {/* Submit */}
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            'Send Reset Link'
          )}
        </Button>

        {/* Back link */}
        <button
          type="button"
          onClick={onBack}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mx-auto"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to login
        </button>
    </motion.form>
  );
};
