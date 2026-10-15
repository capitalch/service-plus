import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";
import { logout, setCredentials, setSessionMode } from "@/features/auth/store/auth-slice";
import { toUserInstance } from "@/features/auth/utils/login-session";
import { demoLogin } from "@/lib/auth-service";
import type { ApiError } from "@/lib/auth-service";
import { ROUTES } from "@/router/routes";
import { clearContext } from "@/store/context-slice";
import { useAppDispatch } from "@/store/hooks";

/**
 * `<app address>/demo` — the portal's "Try the live demo". Signs the visitor in as the
 * shared demo user with no form, stores the session exactly as the login form does, and
 * opens Jobs. Any earlier session in this browser is replaced.
 */
const DemoPage = () => {
	const dispatch = useAppDispatch();
	const navigate = useNavigate();
	const [error, setError] = useState<string | null>(null);
	// React StrictMode runs effects twice in development; sign in once.
	const startedRef = useRef(false);

	useEffect(() => {
		if (startedRef.current) return;
		startedRef.current = true;

		async function openDemo() {
			try {
				dispatch(logout());
				dispatch(clearContext());
				const result = await demoLogin();
				dispatch(
					setCredentials({
						clientId: "",
						clientName: result.clientCode ?? "",
						emailOrUsername: result.username,
						isSuperAdmin: false,
						refreshToken: result.refreshToken,
						rememberMe: false,
						token: result.accessToken,
						user: toUserInstance(result),
					}),
				);
				dispatch(setSessionMode("client"));
				navigate(ROUTES.client.jobs, { replace: true });
			} catch (err) {
				setError((err as ApiError)?.message || MESSAGES.DEMO_NOT_AVAILABLE);
			}
		}

		void openDemo();
	}, [dispatch, navigate]);

	return (
		<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-100 via-white to-violet-50 p-4">
			<motion.div
				animate={{ opacity: 1, y: 0 }}
				className="w-full max-w-sm rounded-2xl border border-white/60 bg-white px-8 py-6 shadow-lg ring-1 ring-black/5"
				initial={{ opacity: 0, y: 12 }}
				transition={{ duration: 0.35, ease: "easeOut" }}
			>
				<div className="mb-4 flex items-center gap-2.5">
					<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600">
						<span className="text-xs font-bold tracking-tight text-white">S+</span>
					</div>
					<span className="text-base font-semibold tracking-tight text-slate-900">Service+</span>
				</div>
				{error ? (
					<div className="space-y-4">
						<p className="text-sm text-slate-600">{error}</p>
						<Button className="w-full" onClick={() => navigate(ROUTES.login)} variant="outline">
							Go to sign in
						</Button>
					</div>
				) : (
					<div className="flex items-center gap-3 text-sm text-slate-600">
						<Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
						{MESSAGES.DEMO_OPENING}
					</div>
				)}
			</motion.div>
		</div>
	);
};

export default DemoPage;
