import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/router/routes';
import { MESSAGES } from '@/constants/messages';

export default function NotFoundPage() {
    const navigate = useNavigate();

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md space-y-8 text-center"
            >
                <div>
                    <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
                        404
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        {MESSAGES.PAGE_NOT_FOUND}
                    </p>
                </div>
                <div className="mt-8 flex justify-center">
                    <Button onClick={() => navigate(ROUTES.home)}>
                        Go back home
                    </Button>
                </div>
            </motion.div>
        </div>
    );
}
