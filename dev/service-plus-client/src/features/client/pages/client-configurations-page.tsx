import { selectCurrentUser } from "@/features/auth/store/auth-slice";
import { ACCESS_RIGHTS, hasAccessRight } from "@/features/auth/utils/access-rights";
import type { AccessRightCode } from "@/features/auth/utils/access-rights";
import {
	CUSTOMER_TYPE_CONFIG,
	DOCUMENT_TYPE_CONFIG,
	JOB_DELIVERY_MANNER_CONFIG,
	JOB_RECEIVE_CONDITION_CONFIG,
	JOB_RECEIVE_MANNER_CONFIG,
	JOB_STATUS_CONFIG,
	JOB_TYPE_CONFIG,
} from "@/features/client/config/lookup-configs";
import { useAppSelector } from "@/store/hooks";
import { ClientLayout, useClientSelection } from "../components/layout/client-layout";
import { AdditionalChargeSection } from "../components/configurations/additional-charge/additional-charge-section";
import { AppSettingsSection } from "../components/configurations/app-settings/app-settings-section";
import { BranchSection } from "../components/configurations/branch/branch-section";
import { DocumentSequenceSection } from "../components/configurations/document-sequence/document-sequence-section";
import { DivisionSection } from "../components/configurations/division/division-section";
import { FinancialYearSection } from "../components/configurations/financial-year/financial-year-section";
import { StateSection } from "../components/configurations/state-province/state-section";
import { LookupSection } from "../components/shared/lookup/lookup-section";

/**
 * Configurations items that need a right beyond CONFIG_MENU; unlisted items are open to everyone
 * with the tab. Both groups moved here from Masters and kept their original MASTERS_* rights.
 */
const ITEM_RIGHTS: Record<string, AccessRightCode> = {
	Branch: ACCESS_RIGHTS.MASTERS_ORGANIZATION,
	"Customer Type": ACCESS_RIGHTS.MASTERS_SERVICE_CONFIG,
	"Document Type": ACCESS_RIGHTS.MASTERS_SERVICE_CONFIG,
	"Financial Year": ACCESS_RIGHTS.MASTERS_ORGANIZATION,
	"Job Additional Charges": ACCESS_RIGHTS.MASTERS_SERVICE_CONFIG,
	"Job Delivery Manner": ACCESS_RIGHTS.MASTERS_SERVICE_CONFIG,
	"Job Receive Condition": ACCESS_RIGHTS.MASTERS_SERVICE_CONFIG,
	"Job Receive Manner": ACCESS_RIGHTS.MASTERS_SERVICE_CONFIG,
	"Job Status": ACCESS_RIGHTS.MASTERS_SERVICE_CONFIG,
	"Job Type": ACCESS_RIGHTS.MASTERS_SERVICE_CONFIG,
	"State / Province": ACCESS_RIGHTS.MASTERS_ORGANIZATION,
};

// ─── Coming Soon placeholder ──────────────────────────────────────────────────

function ComingSoon({ label }: { label: string }) {
	return (
		<div className="flex flex-1 items-center justify-center rounded-lg border border-(--cl-border) bg-(--cl-surface-2) p-20">
			<div className="text-center">
				<p className="text-sm font-semibold text-(--cl-text)">{label}</p>
				<p className="mt-2 text-xs text-(--cl-text-muted)">This configuration feature is coming soon.</p>
			</div>
		</div>
	);
}

// ─── Inner (needs layout context) ─────────────────────────────────────────────

function ConfigurationsContent() {
	const { selected } = useClientSelection();
	const currentUser = useAppSelector(selectCurrentUser);
	const s = selected?.trim() || "";

	// The sidebar disables these items; this only stops a stale selection from rendering them.
	const right = ITEM_RIGHTS[s];
	if (right && !hasAccessRight(currentUser, right)) return null;

	switch (s) {
		case "App Settings":
			return <AppSettingsSection />;
		case "Branch":
			return <BranchSection />;
		case "Customer Type":
			return <LookupSection config={CUSTOMER_TYPE_CONFIG} />;
		case "Divisions":
			return <DivisionSection />;
		case "Document Type":
			return <LookupSection config={DOCUMENT_TYPE_CONFIG} />;
		case "Financial Year":
			return <FinancialYearSection />;
		case "Job Additional Charges":
			return <AdditionalChargeSection />;
		case "Job Delivery Manner":
			return <LookupSection config={JOB_DELIVERY_MANNER_CONFIG} />;
		case "Job Receive Condition":
			return <LookupSection config={JOB_RECEIVE_CONDITION_CONFIG} />;
		case "Job Receive Manner":
			return <LookupSection config={JOB_RECEIVE_MANNER_CONFIG} />;
		case "Job Status":
			return <LookupSection config={JOB_STATUS_CONFIG} />;
		case "Job Type":
			return <LookupSection config={JOB_TYPE_CONFIG} />;
		case "Numbering / Auto Series":
			return <DocumentSequenceSection />;
		case "State / Province":
			return <StateSection />;
		default:
			return <ComingSoon label={s || "Configurations"} />;
	}
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const ClientConfigurationsPage = () => (
	<ClientLayout>
		<ConfigurationsContent />
	</ClientLayout>
);
