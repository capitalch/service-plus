import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClientCombobox } from '@/components/client-combobox';
import { loginSchema, type LoginFormData } from '@/schemas/auth-schemas';
import { loginUser } from '@/store/api/auth-api';
import type { ApiError } from '@/store/api/auth-api';
import { useAppDispatch } from '@/store/hooks';
import { setCredentials } from '@/store/slices/auth-slice';
import { MESSAGES } from '@/constants/messages';

type LoginFormProps = {
  onForgotPassword: () => void;
  onSuccess: () => void;
};

export const LoginForm = ({ onForgotPassword, onSuccess }: LoginFormProps) => {
  const dispatch = useAppDispatch();
  const [isLoading, setIsLoading] = useState(false);
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
      setIsLoading(true);
      const result = await loginUser(data);

      dispatch(
        setCredentials({
          user: result.user,
          token: result.token,
          clientId: data.clientId,
        })
      );

      toast.success(MESSAGES.SUCCESS_LOGIN);
      onSuccess();
    } catch (error) {
      const errorMessage = (error as ApiError)?.message || MESSAGES.ERROR_LOGIN_FAILED;
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
        {/* Client Field */}
        <div className="space-y-1.5">
          <Label htmlFor="client" className="text-sm font-medium text-slate-700">
            Client
            <span className="ml-0.5 text-red-500">*</span>
          </Label>
          <ClientCombobox
            value={clientId}
            onValueChange={(value) => setValue('clientId', value, { shouldValidate: true })}
            error={errors.clientId?.message}
          />
        </div>

        {/* Email / Username Field */}
        <div className="space-y-1.5">
          <Label htmlFor="emailOrUsername" className="text-sm font-medium text-slate-700">
            Email or Username
            <span className="ml-0.5 text-red-500">*</span>
          </Label>
          <Input
            id="emailOrUsername"
            type="text"
            placeholder="Enter your email or username"
            {...register('emailOrUsername')}
            aria-invalid={!!errors.emailOrUsername}
            className="h-10"
            disabled={isLoading}
          />
          {errors.emailOrUsername && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-red-500"
            >
              {errors.emailOrUsername.message}
            </motion.p>
          )}
        </div>

        {/* Password Field */}
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-medium text-slate-700">
            Password
            <span className="ml-0.5 text-red-500">*</span>
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              {...register('password')}
              aria-invalid={!!errors.password}
              className="h-10 pr-10"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-red-500"
            >
              {errors.password.message}
            </motion.p>
          )}
        </div>

        {/* Remember me + Forgot password */}
        <div className="flex items-center justify-between pt-0.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
            />
            <span className="text-sm text-slate-600">Remember me</span>
          </label>

          <button
            type="button"
            onClick={onForgotPassword}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
          >
            Forgot password?
          </button>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-medium mt-1"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign In'
          )}
        </Button>
    </motion.form>
  );
};
