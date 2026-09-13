import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { MESSAGES } from "@/constants/messages";
import { ROUTES } from "@/router/routes";

/**
 * `/client/custom/ew/:ref` — the staff WhatsApp alert's "Open in Service+" button. The
 * approved template appends the lead id to that fixed prefix (plan Part B2). The route is
 * behind ProtectedRoute, so a logged-out tap goes through login and comes back here; no
 * signed token is needed. It renders nothing: it hands the id to the Extended Warranty
 * section through router state and replaces itself, so Back never lands on a redirect.
 */
export const ClientCustomEwRefPage = () => {
	const navigate = useNavigate();
	const { ref } = useParams<{ ref: string }>();

	useEffect(() => {
		const isValid = /^\d+$/.test(ref ?? "");
		if (!isValid) toast.info(MESSAGES.INFO_EW_LEAD_NOT_FOUND);
		navigate(ROUTES.client.custom, {
			replace: true,
			state: { ewLeadId: isValid ? Number(ref) : undefined, subItem: "Extended Warranty" },
		});
	}, [navigate, ref]);

	return null;
};
