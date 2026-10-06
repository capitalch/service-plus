import type { Metadata } from "next";

import { GuardRails } from "@/components/workflow/guard-rails";
import { MoneyTrail } from "@/components/workflow/money-trail";
import { SectionNav } from "@/components/workflow/section-nav";
import { SpecialPaths } from "@/components/workflow/special-paths";
import { StageExplorer } from "@/components/workflow/stage-explorer";
import { StatusMap } from "@/components/workflow/status-map";
import { SwimlaneBoard } from "@/components/workflow/swimlane-board";
import { WorkflowCta } from "@/components/workflow/workflow-cta";
import { WorkflowSection } from "@/components/workflow/workflow-section";
import { MESSAGES } from "@/constants/messages";

export const metadata: Metadata = {
	alternates: { canonical: "/workflow/" },
	description:
		"The complete Service+ job workflow: intake, assignment and estimates, repair tracking, finalization, delivery with GST invoicing and WhatsApp, and accounts posting.",
	title: "Workflow",
};

/** Reading order: the whole flow at a glance (map), then each stage in depth, then who does the
 *  work and where the money is recorded, then the exceptions and the rules that guard them. The
 *  sticky nav lists the sections in the same order. */
const WorkflowPage = () => {
	return (
		<>
			<SectionNav />

			<WorkflowSection
				eyebrow="Workflow"
				id="status-map"
				intro={MESSAGES.workflowMapIntro}
				introBeside
				level="h1"
				tight
				title={MESSAGES.workflowMapTitle}
			>
				<StatusMap />
			</WorkflowSection>

			<WorkflowSection
				eyebrow="Stages"
				id="stages"
				intro={MESSAGES.workflowJourneyIntro}
				title={MESSAGES.workflowJourneyTitle}
			>
				<StageExplorer />
			</WorkflowSection>

			<WorkflowSection
				eyebrow="Roles"
				id="roles"
				intro={MESSAGES.workflowLanesIntro}
				title={MESSAGES.workflowLanesTitle}
			>
				<SwimlaneBoard />
			</WorkflowSection>

			<WorkflowSection
				eyebrow="Money"
				id="money"
				intro={MESSAGES.workflowMoneyIntro}
				title={MESSAGES.workflowMoneyTitle}
			>
				<MoneyTrail />
			</WorkflowSection>

			<WorkflowSection
				eyebrow="Detours"
				id="detours"
				intro={MESSAGES.workflowPathsIntro}
				title={MESSAGES.workflowPathsTitle}
			>
				<SpecialPaths />
			</WorkflowSection>

			<WorkflowSection
				eyebrow="Rules"
				id="rules"
				intro={MESSAGES.workflowGuardIntro}
				title={MESSAGES.workflowGuardTitle}
			>
				<GuardRails />
			</WorkflowSection>

			<WorkflowCta />
		</>
	);
};

export default WorkflowPage;
