import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { MESSAGES } from "@/constants/messages";
import { IDLE_CHECK_INTERVAL_MS, IDLE_LOGOUT_MS, IDLE_WARNING_MS } from "@/constants/timing";
import { logout } from "@/features/auth/store/auth-slice";
import { useAppDispatch } from "@/store/hooks";
import { ROUTES } from "@/router/routes";

const WARNING_TOAST_ID = "idle-logout-warning";

const ACTIVITY_EVENTS = ["click", "keydown", "mousemove", "scroll", "touchstart", "wheel"] as const;

/**
 * Signs the user out after IDLE_LOGOUT_MS without input, warning IDLE_WARNING_MS beforehand. The last-activity time is compared on an
 * interval (not a single long timeout) so a sleeping laptop or a throttled background tab still
 * logs out as soon as the page wakes.
 */
export const useIdleLogout = () => {
	const dispatch = useAppDispatch();
	const navigate = useNavigate();

	useEffect(() => {
		let lastActivity = Date.now();
		let warned = false;

		function handleActivity() {
			lastActivity = Date.now();
			if (warned) {
				warned = false;
				toast.dismiss(WARNING_TOAST_ID);
			}
		}

		function checkIdle() {
			const idleFor = Date.now() - lastActivity;
			if (idleFor < IDLE_LOGOUT_MS) {
				if (!warned && idleFor >= IDLE_LOGOUT_MS - IDLE_WARNING_MS) {
					warned = true;
					toast.warning(MESSAGES.INFO_IDLE_WARNING, { duration: Infinity, id: WARNING_TOAST_ID });
				}
				return;
			}
			toast.dismiss(WARNING_TOAST_ID);
			dispatch(logout());
			navigate(ROUTES.login);
			toast.info(MESSAGES.INFO_IDLE_LOGOUT);
		}

		ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, handleActivity, { passive: true }));
		document.addEventListener("visibilitychange", checkIdle);
		const timer = window.setInterval(checkIdle, IDLE_CHECK_INTERVAL_MS);

		return () => {
			ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, handleActivity));
			document.removeEventListener("visibilitychange", checkIdle);
			window.clearInterval(timer);
		};
	}, [dispatch, navigate]);
};
