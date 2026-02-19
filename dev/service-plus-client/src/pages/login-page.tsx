import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LoginForm } from '@/components/login-form';
import { ForgotPasswordForm } from '@/components/forgot-password-form';

type ViewState = 'login' | 'forgotPassword';

export const LoginPage = () => {
  const [view, setView] = useState<ViewState>('login');
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-sm"
      >
        {/* Card */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-8 py-9">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 shrink-0">
              <span className="text-white font-bold text-xs tracking-tight">S+</span>
            </div>
            <div className='flex items-center justify-between w-full'>
              <span className="text-slate-900 font-semibold text-base tracking-tight">Service+</span>
              <span className='text-xs mt-1 text-slate-400'>{view === 'login' ? 'Sign in' : ''} </span>
            </div>
          </div>

          {/* View title */}
          <AnimatePresence mode="wait">
            <motion.p
              key={view}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="text-sm text-slate-500 mb-2"
            >
              {view === 'login' ? '' : 'Enter your email to receive a password reset link'}
            </motion.p>
          </AnimatePresence>

          {/* Forms */}
          <AnimatePresence mode="wait">
            {view === 'login' ? (
              <LoginForm
                key="login"
                onForgotPassword={() => setView('forgotPassword')}
                onSuccess={() => navigate('/')}
              />
            ) : (
              <ForgotPasswordForm
                key="forgotPassword"
                onBack={() => setView('login')}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-5">
          © {new Date().getFullYear()} Service+. All rights reserved.
        </p>
      </motion.div>
    </div>
  );
};

export default LoginPage;
