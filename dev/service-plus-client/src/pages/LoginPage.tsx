import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginForm } from '@/components/LoginForm';
import { ForgotPasswordForm } from '@/components/ForgotPasswordForm';
import { MESSAGES } from '@/constants/messages';

/**
 * View State Type
 */
type ViewState = 'login' | 'forgotPassword';

/**
 * LoginPage Component
 * Main authentication page that orchestrates login and forgot password views
 * Arrow function as per CLAUDE.md conventions
 *
 * Features:
 * - View switching between login and forgot password
 * - Animated transitions with AnimatePresence
 * - Beautiful gradient background with decorative elements
 * - Responsive design
 * - Navigation on successful login
 */
export const LoginPage = () => {
  const [view, setView] = useState<ViewState>('login');
  const navigate = useNavigate();

  const handleLoginSuccess = () => {
    // Navigate to home/dashboard after successful login
    navigate('/');
  };

  const handleForgotPassword = () => {
    setView('forgotPassword');
  };

  const handleBackToLogin = () => {
    setView('login');
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-linear-to-br from-blue-50 via-white to-cyan-50 p-4">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Gradient Orbs - Blue/Purple/Teal Theme */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-linear-to-br from-blue-300 via-indigo-300 to-purple-300 opacity-40 blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-linear-to-br from-cyan-300 via-teal-300 to-emerald-300 opacity-35 blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2],
            x: [0, 30, 0],
            y: [0, -30, 0],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-linear-to-br from-sky-300 via-blue-300 to-indigo-300 opacity-30 blur-3xl"
        />
      </div>

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="relative"
        >
          {/* Decorative glow behind card - Blue/Purple/Teal */}
          <div className="absolute -inset-4 bg-linear-to-br from-blue-400/25 via-indigo-400/20 to-cyan-400/25 blur-2xl rounded-3xl opacity-60" />

          <Card className="relative overflow-hidden border-2 border-white/70 shadow-2xl backdrop-blur-md bg-white/95 hover:shadow-blue-500/20 transition-all duration-500">
            {/* Top accent gradient line - Blue/Purple/Teal */}
            <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-blue-400 via-indigo-400 to-cyan-400" />

            {/* Inner colorful glow overlay */}
            <div className="absolute inset-0 bg-linear-to-br from-blue-50/40 via-indigo-50/30 to-cyan-50/35 pointer-events-none" />

            <CardHeader className="relative flex items-center gap-4">
              {/* Service+ Title with Icon */}
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{
                    rotate: [0, 5, -5, 0],
                    scale: [1, 1.05, 1]
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="relative"
                >
                  {/* Icon glow effect - Blue/Purple */}
                  <div className="absolute inset-0 bg-linear-to-br from-blue-400 to-indigo-500 opacity-50 blur-lg rounded-full" />
                  <Sparkles className="relative h-6 w-6 text-indigo-600" />
                </motion.div>
                <CardTitle className="text-2xl font-bold tracking-tight bg-linear-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Service<span className="bg-linear-to-r from-cyan-600 via-teal-600 to-emerald-600 bg-clip-text text-transparent">+</span>
                </CardTitle>
              </div>
              <CardDescription className="text-xs bg-linear-to-r from-indigo-600 to-cyan-600 bg-clip-text text-transparent font-medium mt-1 ml-auto">
                {view === 'login' ? MESSAGES.LOGIN_SUBTITLE : MESSAGES.FORGOT_PASSWORD_SUBTITLE}
              </CardDescription>
            </CardHeader>

            <CardContent className="relative pb-4">
              <AnimatePresence mode="wait">
                {view === 'login' ? (
                  <LoginForm
                    key="login"
                    onForgotPassword={handleForgotPassword}
                    onSuccess={handleLoginSuccess}
                  />
                ) : (
                  <ForgotPasswordForm
                    key="forgotPassword"
                    onBack={handleBackToLogin}
                  />
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-4 text-center"
        >
          <p className="text-xs bg-linear-to-r from-blue-500 via-indigo-500 to-cyan-500 bg-clip-text text-transparent font-medium">
            Service+ Client © {new Date().getFullYear()} • Secure & Reliable
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
