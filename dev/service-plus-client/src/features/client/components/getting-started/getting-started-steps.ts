import { MESSAGES } from "@/constants/messages";
import { ROUTES } from "@/router/routes";

// The "Getting started" checklist (plans/plan.md): the only list of its steps. A step is done
// when GET_GETTING_STARTED_PROGRESS says so — nobody ticks anything by hand.

/** One row of GET_GETTING_STARTED_PROGRESS (server JobsSql). Opening jobs never count. */
export type GettingStartedProgressType = {
	has_assigned_job: boolean;
	has_brands_products: boolean;
	has_delivered_job: boolean;
	has_final_job: boolean;
	has_job: boolean;
	has_technician: boolean;
};

export type GettingStartedStepType = {
	done: (progress: GettingStartedProgressType) => boolean;
	helpArticleId: string;
	hint: string;
	id: string;
	label: string;
	/** subItem must be the menu label exactly — client-layout.tsx selects the menu item by it. subGroup
	 *  is its collapsible group, which client-layout opens and shows in the title. */
	target: { route: string; subGroup?: string; subItem: string };
};

export const GETTING_STARTED_STEPS: GettingStartedStepType[] = [
	{
		done: (p) => p.has_brands_products,
		helpArticleId: "brands-models",
		hint: MESSAGES.GS_HINT_BRANDS,
		id: "brands",
		label: "Add brands and products",
		target: { route: ROUTES.client.masters, subGroup: "Product & Parts", subItem: "Brand" },
	},
	{
		done: (p) => p.has_technician,
		helpArticleId: "technicians",
		hint: MESSAGES.GS_HINT_TECHNICIAN,
		id: "technician",
		label: "Add a technician",
		target: { route: ROUTES.client.masters, subGroup: "Entities", subItem: "Technician" },
	},
	{
		done: (p) => p.has_job,
		helpArticleId: "create-job",
		hint: MESSAGES.GS_HINT_JOB,
		id: "job",
		label: "Create your first job",
		target: { route: ROUTES.client.jobs, subGroup: "New Job", subItem: "Single Job" },
	},
	{
		done: (p) => p.has_assigned_job,
		helpArticleId: "job-control",
		hint: MESSAGES.GS_HINT_ASSIGN,
		id: "assign",
		label: "Assign a technician",
		target: { route: ROUTES.client.jobs, subItem: "Job Control" },
	},
	{
		done: (p) => p.has_final_job,
		helpArticleId: "finalize-job",
		hint: MESSAGES.GS_HINT_FINALIZE,
		id: "finalize",
		label: "Finalize the job",
		target: { route: ROUTES.client.jobs, subItem: "Final a Job" },
	},
	{
		done: (p) => p.has_delivered_job,
		helpArticleId: "deliver-job",
		hint: MESSAGES.GS_HINT_DELIVER,
		id: "deliver",
		label: "Deliver the job",
		target: { route: ROUTES.client.jobs, subItem: "Deliver Job" },
	},
];
