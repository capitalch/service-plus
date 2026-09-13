import { selectCurrentUser } from "@/features/auth/store/auth-slice";
import { selectExtendedWarrantyEnabled } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

import { ExtendedWarrantySection } from "../components/custom/extended-warranty/extended-warranty-section";
import { ClientLayout, useClientSelection } from "../components/layout/client-layout";
import { getVisibleCustomMenuItems } from "../components/layout/custom-menu-registry";

// ─── Coming Soon placeholder ──────────────────────────────────────────────────

function ComingSoon({ label }: { label: string }) {
	return (
		<div className="flex flex-1 items-center justify-center rounded-lg border border-(--cl-border) bg-(--cl-surface-2) p-20">
			<div className="text-center">
				<p className="text-sm font-semibold text-(--cl-text)">{label}</p>
				<p className="mt-2 text-xs text-(--cl-text-muted)">This add-on is coming soon.</p>
			</div>
		</div>
	);
}

// ─── Inner (needs layout context) ─────────────────────────────────────────────

// Shows the selected add-on — or the first visible one when nothing is selected yet (the
// Custom section has no fixed default). An add-on that is not visible to this user is
// never rendered, even when named in router state.
function CustomContent() {
	const { selected } = useClientSelection();
	const extendedWarrantyEnabled = useAppSelector(selectExtendedWarrantyEnabled);
	const user = useAppSelector(selectCurrentUser);
	const items = getVisibleCustomMenuItems(user, { extendedWarrantyEnabled });
	const label = selected?.trim() || items[0]?.label || "";
	const isVisible = items.some((item) => item.label === label);

	if (label === "Extended Warranty" && isVisible) return <ExtendedWarrantySection />;
	return <ComingSoon label={label || "Custom"} />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const ClientCustomPage = () => (
	<ClientLayout>
		<CustomContent />
	</ClientLayout>
);
