import { MESSAGES } from "@/constants/messages";
import { selectIsDemo } from "@/features/auth/store/auth-slice";
import { selectIsReadOnly } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

/** True while the current BU is view-only for an unpaid month (status from the server) or the session is the live demo. */
export const useIsReadOnly = (): boolean => useAppSelector(selectIsReadOnly);

/** Why a write control is disabled: the live demo, or an unpaid month. */
export const useReadOnlyTooltip = (): string =>
	useAppSelector(selectIsDemo) ? MESSAGES.DEMO_READ_ONLY_TOOLTIP : MESSAGES.READ_ONLY_TOOLTIP;
