import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClientCombobox } from '@/components/ClientCombobox';
import { loginSchema, type LoginFormData } from '@/schemas/authSchemas';
import { useLoginMutation } from '@/store/api/authApi';
import { useAppDispatch } from '@/store/hooks';
import { setCredentials } from '@/store/slices/authSlice';
import { MESSAGES } from '@/constants/messages';

/**
 * LoginForm Props
 */
interface LoginFormProps {
  onForgotPassword: () => void;
  onSuccess: () => void;
}

/**
 * LoginForm Component
 * Main login form with client selection, email/username, and password fields
 * Arrow function as per CLAUDE.md conventions
 *
 * Features:
 * - react-hook-form with Zod validation
 * - Client type-ahead dropdown
 * - Password visibility toggle
 * - Remember me checkbox
 * - Loading states
 * - Error handling with toast notifications
 * - Redux integration for auth state
 * - Framer Motion entrance animation
 */
export const LoginForm = ({ onForgotPassword, onSuccess }: LoginFormProps) => {
  const dispatch = useAppDispatch();
  const [login, { isLoading }] = useLoginMutation();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      clientId: '',
      emailOrUsername: '',
      password: '',
    },
  });

  const clientId = watch('clientId');

  const onSubmit = async (data: LoginFormData) => {
    try {
      const result = await login(data).unwrap();

      // Store credentials in Redux and localStorage
      dispatch(
        setCredentials({
          user: result.user,
          token: result.token,
          clientId: data.clientId,
        })
      );

      // Show success notification
      toast.success(MESSAGES.SUCCESS_LOGIN);

      // Call success callback (navigate to dashboard)
      onSuccess();
    } catch (error) {
      // Handle error
      const errorMessage =
        (error as { data?: { message?: string } })?.data?.message ||
        MESSAGES.ERROR_LOGIN_FAILED;
      toast.error(errorMessage);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4"
    >
      {/* Client Selection Field */}
      <div className="space-y-2">
        <Label htmlFor="client" className="text-indigo-700 font-semibold">
          {MESSAGES.CLIENT_LABEL}
          <span className="text-red-500">{MESSAGES.REQUIRED_FIELD_INDICATOR}</span>
        </Label>
        <ClientCombobox
          value={clientId}
          onValueChange={(value) => setValue('clientId', value, { shouldValidate: true })}
          error={errors.clientId?.message}
        />
      </div>

      {/* Email or Username Field */}
      <div className="space-y-2">
        <Label htmlFor="emailOrUsername" className="text-blue-700 font-semibold">
          {MESSAGES.EMAIL_OR_USERNAME_LABEL}
          <span className="text-red-500">{MESSAGES.REQUIRED_FIELD_INDICATOR}</span>
        </Label>
        <Input
          id="emailOrUsername"
          type="text"
          placeholder={MESSAGES.EMAIL_OR_USERNAME_PLACEHOLDER}
          {...register('emailOrUsername')}
          className={errors.emailOrUsername ? 'border-red-500' : 'border-blue-200 focus:border-indigo-400 focus:ring-indigo-400'}
          disabled={isLoading}
        />
        {errors.emailOrUsername && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-red-500"
          >
            {errors.emailOrUsername.message}
          </motion.p>
        )}
      </div>

      {/* Password Field */}
      <div className="space-y-2">
        <Label htmlFor="password" className="text-teal-700 font-semibold">
          {MESSAGES.PASSWORD_LABEL}
          <span className="text-red-500">{MESSAGES.REQUIRED_FIELD_INDICATOR}</span>
        </Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder={MESSAGES.PASSWORD_PLACEHOLDER}
            {...register('password')}
            className={errors.password ? 'border-red-500 pr-10' : 'border-teal-200 focus:border-cyan-400 focus:ring-cyan-400 pr-10'}
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-indigo-400 hover:text-blue-600 transition-colors"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-red-500"
          >
            {errors.password.message}
          </motion.p>
        )}
      </div>

      {/* Remember Me and Forgot Password Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="remember"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded border-indigo-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500"
          />
          <Label htmlFor="remember" className="cursor-pointer text-sm font-normal text-indigo-700">
            {MESSAGES.REMEMBER_ME_LABEL}
          </Label>
        </div>

        <button
          type="button"
          onClick={onForgotPassword}
          className="cursor-pointer text-sm font-medium bg-linear-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent hover:from-blue-700 hover:to-cyan-700 transition-all"
        >
          {MESSAGES.FORGOT_PASSWORD_LINK}
        </button>
      </div>

      {/* Submit Button - Blue/Purple Gradient */}
      <Button
        type="submit"
        className="w-full bg-linear-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white font-semibold shadow-lg hover:shadow-xl hover:shadow-indigo-500/50 transition-all duration-300 transform hover:scale-[1.02]"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {MESSAGES.LOADING_LOGIN}
          </>
        ) : (
          MESSAGES.LOGIN_BUTTON
        )}
      </Button>
    </motion.form>
  );
};
