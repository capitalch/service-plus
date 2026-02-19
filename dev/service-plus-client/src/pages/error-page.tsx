import { useNavigate, useRouteError } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MESSAGES } from '@/constants/messages';

const ErrorPage = () => {
  const error = useRouteError();
  const navigate = useNavigate();

  const getMessage = () => {
    if (error instanceof Response) {
      return error.statusText || MESSAGES.ERROR_UNKNOWN;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return MESSAGES.ERROR_UNKNOWN;
  };

  const getStatus = () => {
    if (error instanceof Response) return error.status;
    return null;
  };

  const status = getStatus();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="flex max-w-md flex-col items-center gap-6 rounded-xl bg-white p-10 shadow-lg text-center"
        initial={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
          <AlertCircle className="h-8 w-8 text-slate-500" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-800">
            {status ? `Error ${status}` : 'Something went wrong'}
          </h1>
          <p className="text-sm text-slate-500">{getMessage()}</p>
        </div>

        <Button
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
          onClick={() => navigate('/login')}
        >
          Go to Login
        </Button>
      </motion.div>
    </div>
  );
};

export default ErrorPage;
