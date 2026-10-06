import {
	BadgeIndianRupee,
	BarChart3,
	Boxes,
	Building2,
	Calculator,
	ClipboardCheck,
	ClipboardList,
	FileClock,
	History,
	Landmark,
	Layers,
	PackageCheck,
	ReceiptIndianRupee,
	ShieldCheck,
	Truck,
	Undo2,
	UserCog,
	Wallet,
	Wrench,
	XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/* ─── Journey: the six stages a job passes through ─────────────────────────────────────────── */

export type WorkflowFacetType = {
	label: "Produces" | "Status after" | "WhatsApp" | "Where" | "Who";
	value: string;
};

export type WorkflowPhaseType = {
	anchor: string;
	facets: WorkflowFacetType[];
	icon: LucideIcon;
	steps: string[];
	summary: string;
	title: string;
};

export const workflowPhases: WorkflowPhaseType[] = [
	{
		anchor: "intake",
		facets: [
			{ label: "Who", value: "Front desk" },
			{ label: "Where", value: "Jobs → New Job → Single Job or Batch Jobs" },
			{ label: "Produces", value: "Auto-numbered job card, printed job sheet, photos and attachments" },
			{ label: "WhatsApp", value: "Job Intake Notice with a no-login repair-status link and job slip PDF" },
			{ label: "Status after", value: "Received" },
		],
		icon: ClipboardList,
		steps: [
			"Search the customer by name or mobile, or add a new one with address and GSTIN.",
			"Choose the job type — Make Ready, Estimate, Under Warranty, Installation, Inspection, AMC and more. It decides the path the job can take.",
			"Pick the division. It decides GST or non-GST invoicing for this job.",
			"Record how the device came in and its condition, then brand → product → model, serial number and warranty card.",
			"Write the problem the customer reported, and optionally assign a technician straight away.",
			"Save. The job number is drawn from your Job Sheet series and the job sheet prints in as many copies as you set.",
			"Take an advance if the customer pays one — it is a money receipt against the job.",
		],
		summary:
			"The device arrives at the counter and becomes a job card. One device per job, or a whole batch for one customer under a single batch number.",
		title: "Receive the device",
	},
	{
		anchor: "assign",
		facets: [
			{ label: "Who", value: "Front desk or manager, then the technician" },
			{ label: "Where", value: "Jobs → Job Control, or Job Pipeline grouped by status" },
			{ label: "Produces", value: "A dated transaction for every move, with remarks and the user who made it" },
			{ label: "WhatsApp", value: "Customer can open the status link at any time and see the live stage" },
			{ label: "Status after", value: "Assigned, Estimated, Estimate Approved or Estimate Rejected" },
		],
		icon: UserCog,
		steps: [
			"Move the job to Assigned and choose the technician — or use Set Technician to change hands without changing the status.",
			"Where the customer wants a price first, move to Estimated and enter the estimate amount.",
			"Record the customer's answer: Estimate Approved sends it to the bench, Estimate Rejected sends it back as Return.",
			"An Estimate-type job can only go to Assigned or Estimated from Received, so a price is always agreed before work starts.",
			"Job Pipeline shows how many jobs sit in each status and lets you act on a whole status group.",
		],
		summary: "The job gets an owner and, when the customer wants one, a price before anyone opens the device.",
		title: "Assign and estimate",
	},
	{
		anchor: "repair",
		facets: [
			{ label: "Who", value: "Technician" },
			{ label: "Where", value: "Job Control ⇄ menu, Jobs → Part Used (Job), Parts & Charges" },
			{ label: "Produces", value: "Spare parts consumed from branch stock, a full status history" },
			{ label: "WhatsApp", value: "Status link updates on its own as the job moves" },
			{ label: "Status after", value: "Completed OK, Return, Cancelled or Disposed" },
		],
		icon: Wrench,
		steps: [
			"Start the work: In Progress. Re-start or re-assign at any time.",
			"Pause with a reason the whole shop can see — Parts Pending, On Hold or Outsourced — and resume to In Progress.",
			"Send a unit to the manufacturer with Sent to Company, then Received Back when it returns.",
			"Book every spare part used. Stock drops at once through a consumption entry, and cost and selling price fill from the part master.",
			"Finish with Completed OK if the device works, or Return if it cannot be repaired.",
			"Cancelled and Disposed close a job that will not be repaired — both can be re-opened later.",
			"Made a wrong move? Undo Last Transaction steps the job back one status.",
		],
		summary:
			"The bench. Every pause, hand-off and part is recorded against the job, so nobody has to ask where a device is.",
		title: "Repair and track",
	},
	{
		anchor: "finalize",
		facets: [
			{ label: "Who", value: "Manager or front desk" },
			{ label: "Where", value: "Jobs → Final a Job → Pending, or Final the Job from Job Control" },
			{ label: "Produces", value: "Locked final amount, proforma invoice on demand" },
			{ label: "WhatsApp", value: "“Your device is ready for collection” — sent in bulk from Customer Connect" },
			{ label: "Status after", value: "Completed OK · Final" },
		],
		icon: Calculator,
		steps: [
			"Completed OK jobs wait in the Pending list. Return jobs are finalized automatically and skip this stage.",
			"Review parts used and add service charges — labour, diagnostic, visit fee. HSN and GST rate fill from the masters.",
			"Type a target amount and Apply: prices move parts first, then other charges, and touch labour only as a last resort.",
			"Lock any charge you agreed with the customer so Apply never reprices it.",
			"Warranty jobs start every line at ₹0 — enter a price only for what the customer actually pays for.",
			"Choose whether the invoice lists every part or one merged line, and force IGST for inter-state customers.",
			"Save & Mark Final. The job is locked for invoicing and ready to hand over.",
		],
		summary:
			"Price the job and lock it. What the customer will pay is decided here — once, deliberately, with GST worked out for you.",
		title: "Finalize the bill",
	},
	{
		anchor: "deliver",
		facets: [
			{ label: "Who", value: "Front desk" },
			{ label: "Where", value: "Jobs → Deliver Job (one job or many together)" },
			{ label: "Produces", value: "GST service invoice, money receipts, delivery note" },
			{ label: "WhatsApp", value: "Delivery summary with invoice and delivery note, plus a 4-digit pickup code" },
			{ label: "Status after", value: "Delivered OK or Delivered Not OK — job closed" },
		],
		icon: Truck,
		steps: [
			"Select every finalized job the customer is collecting — total, already received and balance due show at once.",
			"Take payment: cash, card, UPI, cheque, bank transfer or other, split across as many receipts as needed.",
			"Pick delivery manner and date, add remarks.",
			"One button runs Receipts + Delivery + Invoice. If a balance is still due, the receipt dialog opens first.",
			"The service invoice is numbered from your invoice series. A ₹0 job — a free warranty repair — never gets one.",
			"Hand over paper (delivery note, invoice + receipt PDF) or go paperless over WhatsApp.",
			"Paperless: the customer reads back the 4-digit code from their phone and you verify it as proof of collection.",
		],
		summary: "Money in, invoice out, device handed over — in a single action, for one job or a whole counter-full.",
		title: "Collect and deliver",
	},
	{
		anchor: "after",
		facets: [
			{ label: "Who", value: "Manager or owner" },
			{ label: "Where", value: "Accounts Posting, Delivered Jobs row actions, Reports" },
			{ label: "Produces", value: "Posted vouchers, corrected profit, performance reports" },
			{ label: "WhatsApp", value: "Re-send invoice or any money receipt whenever the customer asks" },
			{ label: "Status after", value: "Closed — editable only through Undo, until posted" },
		],
		icon: BarChart3,
		steps: [
			"Post receipts and job invoices to your accounting system in one run, branch by branch.",
			"Fix a wrong or missing part cost with Correct Costs — even on a posted job — without touching the invoice.",
			"Re-send the invoice or a money receipt on WhatsApp from the Delivered Jobs list.",
			"Undo Delivery if a job was closed by mistake, as long as its invoice has not been posted.",
			"Read the results: job pipeline and ageing, technician performance and profit, financial reports.",
		],
		summary:
			"The job is closed, but its numbers keep working — in your books, in your reports and for your customer.",
		title: "Account and review",
	},
];

/* ─── Swimlane: who does what at each stage ────────────────────────────────────────────────── */

export type SwimlaneType = {
	cells: string[][];
	icon: LucideIcon;
	lane: string;
};

// One row per actor; cells line up with workflowPhases by index.
export const swimlanes: SwimlaneType[] = [
	{
		cells: [
			["Drops off the device", "Pays an advance (optional)"],
			["Approves or rejects the estimate"],
			["Checks repair status from the link"],
			["Gets “ready for collection”"],
			["Pays the balance", "Reads back the pickup code"],
			["Downloads invoice or receipt any time"],
		],
		icon: Building2,
		lane: "Customer",
	},
	{
		cells: [
			["Creates the job card", "Prints the job sheet", "Sends the intake notice"],
			["Assigns a technician", "Records the estimate"],
			[],
			["Sends completion messages in bulk"],
			["Takes payment", "Delivers and invoices", "Verifies the pickup code"],
			["Re-sends documents"],
		],
		icon: ClipboardCheck,
		lane: "Front desk",
	},
	{
		cells: [
			[],
			["Diagnoses the fault"],
			["Moves the job through work statuses", "Books spare parts used", "Marks Completed OK or Return"],
			[],
			[],
			[],
		],
		icon: Wrench,
		lane: "Technician",
	},
	{
		cells: [
			[],
			["Watches the pipeline"],
			["Clears parts and vendor hold-ups"],
			["Sets parts and charges", "Applies the target amount", "Marks the job Final"],
			["Approves undo, if needed"],
			["Posts to accounts", "Corrects costs", "Reads profit reports"],
		],
		icon: UserCog,
		lane: "Manager",
	},
	{
		cells: [
			["Numbers the job", "Opens a status link"],
			["Logs every move with user and date"],
			["Reduces stock per part"],
			["Works out GST", "Locks the job"],
			["Numbers invoice and receipts", "Closes the job", "Tracks WhatsApp to Delivered/Read"],
			["Keeps the history", "Blocks edits once posted"],
		],
		icon: Layers,
		lane: "Service+",
	},
];

/* ─── Status map: every status, its next moves and its place on the diagram ────────────────── */

export type StatusToneType =
	"ended" | "estimate" | "external" | "final" | "intake" | "notFixed" | "paused" | "success" | "work";

/** What the move dialog asks for: remarks always, plus technician (required or optional) and estimate. */
export type MoveNeedType = "Estimate" | "Remarks" | "Technician" | "Technician (optional)";

export type StatusMoveType = {
	/** Curve override for the diagram, where the default bend would run the line through another node. */
	bend?: number;
	kind: "move" | "process" | "undo";
	label: string;
	/** Where along the curve its label sits (0 = source, 1 = target), where the default lands on a node. */
	labelT?: number;
	needs: MoveNeedType[];
	to: string;
};

export type WorkflowStatusType = {
	closed: boolean;
	code: string;
	description: string;
	final: boolean;
	moves: StatusMoveType[];
	name: string;
	note?: string;
	tone: StatusToneType;
	x: number;
	y: number;
};

const R: MoveNeedType[] = ["Remarks"];
const RT: MoveNeedType[] = ["Remarks", "Technician"];
const RET: MoveNeedType[] = ["Remarks", "Estimate", "Technician"];
const Rt: MoveNeedType[] = ["Remarks", "Technician (optional)"];

function move(to: string, label: string, needs: MoveNeedType[], bend?: number, labelT?: number): StatusMoveType {
	return { bend, kind: "move", label, labelT, needs, to };
}

function process(to: string, label: string): StatusMoveType {
	return { kind: "process", label, needs: [], to };
}

function undo(to: string, label: string): StatusMoveType {
	return { kind: "undo", label, needs: [], to };
}

export const STATUS_MAP_SIZE = { height: 1000, width: 1800 };

export type StatusBandType = {
	label: string;
	x0: number;
	x1: number;
};

/** Stage columns on the diagram. Statuses are placed inside the column of the stage they belong to. */
export const statusBands: StatusBandType[] = [
	{ label: "Intake", x0: 0, x1: 297 },
	{ label: "Assign & estimate", x0: 297, x1: 599 },
	{ label: "Repair", x0: 599, x1: 1203 },
	{ label: "Outcome", x0: 1203, x1: 1505 },
	{ label: "Final & deliver", x0: 1505, x1: 1800 },
];

export const workflowStatuses: WorkflowStatusType[] = [
	{
		closed: false,
		code: "RECEIVED",
		description: "The job card exists and the device is in the shop. Nothing has been done to it yet.",
		final: false,
		moves: [
			move("ASSIGNED", "Assign", RT),
			move("ESTIMATED", "Estimate", RET),
			move("IN_PROGRESS", "Start work", RT, 0.16),
			move("SENT_TO_COMPANY", "Send to company", Rt, 0.04, 0.5),
			move("COMPLETED_OK", "Completed OK", RT, 0.26),
			move("RETURN", "Return", R, 0.16),
			move("CANCELLED", "Cancel", R, -0.26),
			move("DISPOSED", "Dispose", R, 0.0),
		],
		name: "Received",
		note: "An Estimate-type job can only go to Assigned or Estimated from here.",
		tone: "intake",
		x: 146,
		y: 510,
	},
	{
		closed: false,
		code: "ASSIGNED",
		description: "A technician owns the job. Re-assign as often as needed — the latest technician is shown.",
		final: false,
		moves: [move("ASSIGNED", "Re-assign", RT), move("IN_PROGRESS", "Start work", RT, 0.12)],
		name: "Assigned",
		tone: "intake",
		x: 448,
		y: 330,
	},
	{
		closed: false,
		code: "ESTIMATED",
		description: "An estimate amount has been recorded and the customer has been asked to approve it.",
		final: false,
		moves: [
			move("ESTIMATE_APPROVED", "Approved", R),
			move("ESTIMATE_REJECTED", "Rejected", R, 0.62, 0.75),
			move("IN_PROGRESS", "Start work", RT),
		],
		name: "Estimated",
		tone: "estimate",
		x: 448,
		y: 510,
	},
	{
		closed: false,
		code: "ESTIMATE_APPROVED",
		description: "The customer agreed to the price. The job is cleared for the bench.",
		final: false,
		moves: [move("IN_PROGRESS", "Start work", RT)],
		name: "Estimate Approved",
		tone: "estimate",
		x: 448,
		y: 690,
	},
	{
		closed: false,
		code: "ESTIMATE_REJECTED",
		description: "The customer declined the price. The device goes back unrepaired.",
		final: false,
		moves: [move("RETURN", "Return", R, -0.08)],
		name: "Estimate Rejected",
		note: "No new money receipt can be taken against a job in this status.",
		tone: "estimate",
		x: 448,
		y: 870,
	},
	{
		closed: false,
		code: "IN_PROGRESS",
		description:
			"A technician is working on the device. The hub of the repair stage — almost every path passes here.",
		final: false,
		moves: [
			move("ASSIGNED", "Re-assign", RT),
			move("ESTIMATED", "Estimate", RET),
			move("IN_PROGRESS", "Re-start", RT),
			move("PARTS_PENDING", "Parts pending", R),
			move("ON_HOLD", "Hold", R),
			move("OUTSOURCED", "Outsource", R, -0.04, 0.75),
			move("SENT_TO_COMPANY", "Send to company", Rt),
			move("COMPLETED_OK", "Completed OK", RT),
			move("RETURN", "Return", R),
			move("CANCELLED", "Cancel", R, 0.0),
			move("DISPOSED", "Dispose", R, 0.64),
		],
		name: "In Progress",
		tone: "work",
		x: 750,
		y: 510,
	},
	{
		closed: false,
		code: "PARTS_PENDING",
		description: "Work is paused while a spare part is ordered or arrives.",
		final: false,
		moves: [move("IN_PROGRESS", "Resume", RT)],
		name: "Parts Pending",
		tone: "paused",
		x: 750,
		y: 150,
	},
	{
		closed: false,
		code: "ON_HOLD",
		description: "Work is paused for any other reason — waiting on the customer, a decision or a slot.",
		final: false,
		moves: [move("IN_PROGRESS", "Resume", RT)],
		name: "On Hold",
		note: "Parts cannot be booked and receipts cannot be edited while a job is on hold.",
		tone: "paused",
		x: 1052,
		y: 330,
	},
	{
		closed: false,
		code: "OUTSOURCED",
		description: "A specialist outside the shop is handling part of the repair.",
		final: false,
		moves: [move("IN_PROGRESS", "Back in-house", RT, 0.18)],
		name: "Outsourced",
		tone: "external",
		x: 1052,
		y: 150,
	},
	{
		closed: false,
		code: "SENT_TO_COMPANY",
		description: "The unit has gone to the manufacturer or brand service centre.",
		final: false,
		moves: [move("RECEIVED_BACK_FROM_COMPANY", "Received back", R)],
		name: "Sent to Company",
		tone: "external",
		x: 1052,
		y: 690,
	},
	{
		closed: false,
		code: "RECEIVED_BACK_FROM_COMPANY",
		description: "The unit is back from the company. Finish it, or put it on the bench again.",
		final: false,
		moves: [
			move("IN_PROGRESS", "Start work", RT, -0.04, 0.7),
			move("COMPLETED_OK", "Completed OK", RT, -0.14, 0.5),
		],
		name: "Received Back",
		tone: "external",
		x: 1052,
		y: 870,
	},
	{
		closed: false,
		code: "COMPLETED_OK",
		description: "The device is repaired and working. It now waits to be priced and finalized.",
		final: false,
		moves: [process("FINAL", "Final a Job")],
		name: "Completed OK",
		tone: "success",
		x: 1354,
		y: 330,
	},
	{
		closed: false,
		code: "RETURN",
		description: "The device could not be repaired. It is finalized automatically and goes straight to delivery.",
		final: true,
		moves: [process("DELIVERED_NOT_OK", "Deliver Job")],
		name: "Return",
		note: "A diagnostic or inspection charge can still be invoiced at delivery.",
		tone: "notFixed",
		x: 1354,
		y: 510,
	},
	{
		closed: false,
		code: "CANCELLED",
		description: "The job was abandoned before the repair finished.",
		final: true,
		moves: [move("IN_PROGRESS", "Re-open", RT)],
		name: "Cancelled",
		tone: "ended",
		x: 1354,
		y: 690,
	},
	{
		closed: true,
		code: "DISPOSED",
		description: "The device was scrapped at end of life. The job is closed.",
		final: true,
		moves: [move("IN_PROGRESS", "Re-open", RT, -0.64)],
		name: "Disposed",
		tone: "ended",
		x: 1354,
		y: 870,
	},
	{
		closed: false,
		// Not a stored status: "Completed OK + is_final". Shown as its own node because it is a real stop.
		code: "FINAL",
		description:
			"Completed OK and marked Final: parts, charges and amount are locked. A proforma invoice can be printed and the ready-for-collection message sent.",
		final: true,
		moves: [process("DELIVERED_OK", "Deliver Job"), undo("COMPLETED_OK", "Undo final")],
		name: "Finalized",
		note: "Undo Final needs the job invoice deleted first, and is blocked once the invoice is posted to accounts.",
		tone: "final",
		x: 1656,
		y: 150,
	},
	{
		closed: true,
		code: "DELIVERED_OK",
		description: "Repaired device handed over. Invoice raised, receipts recorded, job closed.",
		final: true,
		moves: [undo("FINAL", "Undo delivery")],
		name: "Delivered OK",
		note: "Undo Delivery is blocked once the invoice is posted to accounts.",
		tone: "success",
		x: 1656,
		y: 330,
	},
	{
		closed: true,
		code: "DELIVERED_NOT_OK",
		description: "Unrepaired device handed back. Any inspection charge is invoiced, and the job is closed.",
		final: true,
		moves: [undo("RETURN", "Undo delivery")],
		name: "Delivered Not OK",
		tone: "notFixed",
		x: 1656,
		y: 510,
	},
];

/** Every job starts here, and the diagram returns to this status when a played path finishes. */
export const START_STATUS = "RECEIVED";

export type WorkflowPathType = {
	/** Status codes in visiting order. A code may repeat — a pause and a resume both land back
	 *  on In Progress. */
	codes: string[];
	id: string;
	label: string;
	/** Tone of the status it ends on, so the button and the diagram agree on what this route is:
	 *  an orange pill for a job that left the bench, a green one for a repair that was delivered. */
	outcome: StatusToneType;
};

/** Where a job can go, start to finish. Each one is a real chain of moves through the map
 *  above, so every path can be played on the diagram. */
export const workflowPaths: WorkflowPathType[] = [
	{
		codes: ["RECEIVED", "ASSIGNED", "IN_PROGRESS", "COMPLETED_OK", "FINAL", "DELIVERED_OK"],
		id: "happy",
		outcome: "success",
		label: "Happy path",
	},
	{
		codes: ["RECEIVED", "IN_PROGRESS", "COMPLETED_OK", "FINAL", "DELIVERED_OK"],
		id: "bench",
		outcome: "success",
		label: "Straight to the bench",
	},
	{
		codes: ["RECEIVED", "ESTIMATED", "ESTIMATE_APPROVED", "IN_PROGRESS", "COMPLETED_OK", "FINAL", "DELIVERED_OK"],
		id: "estimate",
		outcome: "success",
		label: "Estimate first",
	},
	{
		codes: ["RECEIVED", "ESTIMATED", "ESTIMATE_REJECTED", "RETURN", "DELIVERED_NOT_OK"],
		id: "estimate-declined",
		outcome: "notFixed",
		label: "Estimate declined",
	},
	{
		codes: [
			"RECEIVED",
			"ASSIGNED",
			"IN_PROGRESS",
			"PARTS_PENDING",
			"IN_PROGRESS",
			"COMPLETED_OK",
			"FINAL",
			"DELIVERED_OK",
		],
		id: "parts",
		outcome: "success",
		label: "Waiting on parts",
	},
	{
		codes: [
			"RECEIVED",
			"ASSIGNED",
			"IN_PROGRESS",
			"ON_HOLD",
			"IN_PROGRESS",
			"COMPLETED_OK",
			"FINAL",
			"DELIVERED_OK",
		],
		id: "hold",
		outcome: "success",
		label: "On hold",
	},
	{
		codes: [
			"RECEIVED",
			"ASSIGNED",
			"IN_PROGRESS",
			"OUTSOURCED",
			"IN_PROGRESS",
			"COMPLETED_OK",
			"FINAL",
			"DELIVERED_OK",
		],
		id: "outsourced",
		outcome: "success",
		label: "Outsourced",
	},
	{
		codes: [
			"RECEIVED",
			"SENT_TO_COMPANY",
			"RECEIVED_BACK_FROM_COMPANY",
			"IN_PROGRESS",
			"COMPLETED_OK",
			"FINAL",
			"DELIVERED_OK",
		],
		id: "company",
		outcome: "success",
		label: "To the manufacturer",
	},
	{
		codes: ["RECEIVED", "ASSIGNED", "IN_PROGRESS", "RETURN", "DELIVERED_NOT_OK"],
		id: "not-repairable",
		outcome: "notFixed",
		label: "Not repairable",
	},
	{
		codes: [
			"RECEIVED",
			"ASSIGNED",
			"IN_PROGRESS",
			"CANCELLED",
			"IN_PROGRESS",
			"COMPLETED_OK",
			"FINAL",
			"DELIVERED_OK",
		],
		id: "cancelled",
		outcome: "ended",
		label: "Cancelled, then re-opened",
	},
	{
		codes: ["RECEIVED", "DISPOSED"],
		id: "disposed",
		outcome: "ended",
		label: "Disposed",
	},
];

/* ─── Special paths ────────────────────────────────────────────────────────────────────────── */

export type SpecialPathType = {
	description: string;
	flow: string[];
	icon: LucideIcon;
	title: string;
};

export const specialPaths: SpecialPathType[] = [
	{
		description:
			"The customer agrees a price before anyone opens the device. Rejected estimates go back as Return and can still carry an inspection charge.",
		flow: ["Received", "Estimated", "Approved", "In Progress"],
		icon: FileClock,
		title: "Estimate first",
	},
	{
		description:
			"Every part and charge starts at ₹0. A free repair finalizes at ₹0 and never gets an invoice; anything the customer does pay for is invoiced as usual.",
		flow: ["Received", "In Progress", "Completed OK", "Final ₹0", "Delivered"],
		icon: ShieldCheck,
		title: "Under warranty",
	},
	{
		description:
			"Units that must go to the brand are tracked out and back, so the shop always knows which devices are not on its premises.",
		flow: ["In Progress", "Sent to Company", "Received Back", "Completed OK"],
		icon: Truck,
		title: "Manufacturer cycle",
	},
	{
		description:
			"A dealer or courier drop of many devices becomes one batch number with its own batch sheet. Each device is still its own job.",
		flow: ["One customer", "Batch number", "Job per device", "One intake message"],
		icon: Boxes,
		title: "Batch intake",
	},
	{
		description:
			"Free warranty jobs for one customer move together: Completed OK → Final → Deliver in one run, with a combined delivery note at the end.",
		flow: ["Pick customer", "Tick jobs", "Process", "Delivery note"],
		icon: Layers,
		title: "Batch warranty processing",
	},
	{
		description:
			"Jobs that were already open in your old system come in with their old number kept as an alternate reference, then finish through the normal flow.",
		flow: ["Old job no", "Opening job", "Final", "Deliver"],
		icon: History,
		title: "Opening jobs",
	},
	{
		description:
			"When a device cannot be fixed it is returned — finalized automatically, delivered as Not OK, with any inspection fee invoiced.",
		flow: ["In Progress", "Return", "Delivered Not OK"],
		icon: XCircle,
		title: "Not repairable",
	},
	{
		description:
			"Cancelled and Disposed jobs are not dead ends. Re-open puts them straight back to In Progress with a technician.",
		flow: ["Cancelled / Disposed", "Re-open", "In Progress"],
		icon: Undo2,
		title: "Cancel, dispose, re-open",
	},
];

/* ─── Money trail ──────────────────────────────────────────────────────────────────────────── */

export type MoneyStepType = {
	description: string;
	icon: LucideIcon;
	stage: string;
	title: string;
};

export const moneyTrail: MoneyStepType[] = [
	{
		description: "Optional money receipt at the counter, numbered from your receipt series.",
		icon: Wallet,
		stage: "Intake",
		title: "Advance",
	},
	{
		description: "Parts consumed reduce branch stock and carry their cost for profit reports.",
		icon: Wrench,
		stage: "Repair",
		title: "Parts cost",
	},
	{
		description: "Parts and charges priced, target amount applied, GST worked out, job locked.",
		icon: Calculator,
		stage: "Finalize",
		title: "Final amount",
	},
	{
		description: "Service invoice raised automatically at delivery for any job above ₹0.",
		icon: ReceiptIndianRupee,
		stage: "Deliver",
		title: "Invoice",
	},
	{
		description: "Balance collected in any mix of cash, card, UPI, cheque or transfer.",
		icon: BadgeIndianRupee,
		stage: "Deliver",
		title: "Balance",
	},
	{
		description: "Receipts and invoices posted to accounts; posted documents are locked.",
		icon: Landmark,
		stage: "After",
		title: "Posting",
	},
];

/* ─── Guard rails ──────────────────────────────────────────────────────────────────────────── */

export type GuardRailType = {
	action: string;
	allowed: string;
	blocked: string;
	icon: LucideIcon;
};

export const guardRails: GuardRailType[] = [
	{
		action: "Edit a job",
		allowed: "Any time before it is marked Final",
		blocked: "Once Final — undo the final first",
		icon: ClipboardList,
	},
	{
		action: "Undo last transaction",
		allowed: "Steps the job back one status",
		blocked: "After the job is delivered",
		icon: Undo2,
	},
	{
		action: "Book or edit parts used",
		allowed: "While the job is open",
		blocked: "On Hold, Final or Closed jobs",
		icon: Wrench,
	},
	{
		action: "Edit or delete a receipt",
		allowed: "While the job is open and the receipt unposted",
		blocked: "Final, Closed or On Hold jobs; posted receipts",
		icon: Wallet,
	},
	{
		action: "Undo final or revise",
		allowed: "After the job invoice is deleted",
		blocked: "Once the invoice is posted to accounts",
		icon: Calculator,
	},
	{
		action: "Undo delivery",
		allowed: "Re-opens a delivered job",
		blocked: "Once the invoice is posted to accounts",
		icon: PackageCheck,
	},
	{
		action: "Change division",
		allowed: "Any time, prices recalculate for the new GST mode",
		blocked: "If it flips GST status while an invoice exists",
		icon: Building2,
	},
	{
		action: "Correct costs",
		allowed: "At every stage — even delivered and posted jobs",
		blocked: "Never; the invoice is not touched",
		icon: BarChart3,
	},
];

/* ─── Page sections, in reading order, for the sticky section nav ──────────────────────────── */

export type WorkflowSectionLinkType = {
	id: string;
	label: string;
};

export const workflowSections: WorkflowSectionLinkType[] = [
	{ id: "status-map", label: "Status map" },
	{ id: "stages", label: "Stages" },
	{ id: "roles", label: "Roles" },
	{ id: "money", label: "Money" },
	{ id: "detours", label: "Detours" },
	{ id: "rules", label: "Rules" },
];
