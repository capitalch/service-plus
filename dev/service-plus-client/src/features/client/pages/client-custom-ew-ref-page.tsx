import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ROUTES } from "@/router/routes";

/**
 * Resolves the deep link on the staff WhatsApp lead alert's "Open in Service+" button.
 *
 * The alert's URL carries `<ew_customer_id>-<stage>` as its one dynamic segment. This
 * route is behind `ProtectedRoute` like every other client route, so an unauthenticated
 * tap lands on login and returns here afterwards — which is exactly why the link needs
 * no signed token of its own, unlike the customer-facing page.
 *
 * It renders nothing: it normalises the ref into router state and replaces itself with
 * the Custom page, so the back button never returns to a bare redirect.
 */
export const ClientCustomEwRefPage = () => {
	const navigate = useNavigate();
	const { ref } = useParams<{ ref: string }>();

	useEffect(() => {
		const [rawId, rawStage] = (ref ?? "").split("-");
		const ewCustomerId = Number(rawId);
		const stage = Number(rawStage);

		navigate(ROUTES.client.custom, {
			replace: true,
			state: {
				ewCustomerId: Number.isFinite(ewCustomerId) && ewCustomerId > 0 ? ewCustomerId : undefined,
				ewStage: Number.isFinite(stage) ? stage : undefined,
				subItem: "Extended Warranty",
			},
		});
	}, [navigate, ref]);

	return null;
};
