import { useMemo, useState } from "react";
import { Pencil, PhoneCall, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { SEARCH_DEBOUNCE_MS } from "@/constants/timing";
import { selectDbName } from "@/features/auth/store/auth-slice";
import type {
	EwCustomerType,
	EwLeadRowType,
	EwLeadStatusType,
	EwSendResultType,
} from "@/features/client/types/extended-warranty";
import { useDebounce } from "@/hooks/use-debounce";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { isValidMobile } from "@/lib/mobile";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

import { ReportEmpty } from "../../reports/common/report-empty";
import { ReportError } from "../../reports/common/report-error";
import { ReportLoading } from "../../reports/common/report-loading";
import { useGenericQuery } from "../../reports/common/use-generic-query";
import {
	EW_CHECKBOX_CLASS,
	EW_OUTCOME_LABEL,
	EW_STAGE_STATUS_LABEL,
	bucketsFromStages,
	daysLeftLabel,
	formatDate,
	leadStatusLabel,
	stageLabel,
} from "./extended-warranty-helpers";
import { EwCustomerDialog } from "./ew-customer-dialog";
import { EwSendHistory } from "./ew-status-badge";
import { EwFollowUpDialog } from "./ew-follow-up-dialog";
import { EwLeadDetailDialog } from "./ew-lead-detail-dialog";
import { sendEwReminders } from "./send-ew-reminders";

const GRACE_DAYS = -7;
const PAGE_SIZE = 50;

const STATUS_PILLS: { label: string; value: EwLeadStatusType | null }[] = [
	{ label: "All", value: null },
	{ label: "Due to message", value: "DUE" },
	{ label: "Message sent", value: "MESSAGED" },
	{ label: "Interested", value: "INTERESTED" },
	{ label: "Followed up", value: "FOLLOWED_UP" },
	{ label: "Won", value: "WON" },
	{ label: "Lost", value: "LOST" },
];

type Props = {
	focusCustomerId?: number;
	focusStage?: number;
	initialBucket?: number | null;
	onChanged: () => void;
	stages: number[];
};

/**
 * The Actions tab: the module's single working surface, one row per LEAD. It replaced the
 * three grids that used to split the same customer across Due / Interested / Customers.
 * Everything an operator DOES to a lead — message it, follow it up, close it, edit it —
 * happens here, which is what the tab is named for; the Dashboard only reports.
 *
 * The row is customer-level, so a customer messaged at several stages appears once; the
 * server picks the "current" stage (see GET_EW_LEADS_PAGED). `due_stage` separately says
 * whether a reminder is owed right now, which is what gates selection for sending.
 */
export const EwActionsScreen = ({ focusCustomerId, focusStage, initialBucket, onChanged, stages }: Props) => {
	const branch = useAppSelector(selectCurrentBranch);
	const dbName = useAppSelector(selectDbName);
	const schema = useAppSelector(selectSchema);

	const [bucket, setBucket] = useState<number | null>(initialBucket ?? null);
	const [deletingCustomer, setDeletingCustomer] = useState<EwLeadRowType | null>(null);
	const [detail, setDetail] = useState<EwLeadRowType | null>(null);
	const [leadDialogOpen, setLeadDialogOpen] = useState(false);
	const [editingCustomer, setEditingCustomer] = useState<EwCustomerType | null>(null);
	const [followUp, setFollowUp] = useState<EwLeadRowType | null>(null);
	const [page, setPage] = useState(0);
	const [search, setSearch] = useState("");
	const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
	const [sending, setSending] = useState(false);
	const [status, setStatus] = useState<EwLeadStatusType | null>(null);

	const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS);
	const buckets = useMemo(() => bucketsFromStages(stages, GRACE_DAYS), [stages]);
	const activeBucket = buckets.find((b) => b.value === bucket) ?? null;

	const { data, error, loading, refetch } = useGenericQuery<EwLeadRowType>({
		enabled: !!branch?.id,
		sqlArgs: {
			branch_id: branch?.id ?? null,
			days_left_max: activeBucket?.max ?? null,
			days_left_min: activeBucket?.min ?? null,
			grace_days: GRACE_DAYS,
			limit: PAGE_SIZE,
			offset: page * PAGE_SIZE,
			outcome: null,
			search: debouncedSearch || null,
			stages,
			status,
		},
		sqlId: SQL_MAP.GET_EW_LEADS_PAGED,
	});

	// Only a lead that is actually owed a reminder, and can receive one, is selectable.
	const sendable = useMemo(
		() => data.filter((row) => row.due_stage != null && !!row.mobile && isValidMobile(row.mobile)),
		[data],
	);
	const selectedRows = useMemo(
		() => sendable.filter((row) => selectedIds.has(row.ew_customer_id)),
		[sendable, selectedIds],
	);
	const allSelected = sendable.length > 0 && selectedIds.size === sendable.length;

	// The deep link from the staff alert names one lead; open its follow-up straight away.
	const focused = useMemo(
		() => (focusCustomerId ? data.find((r) => r.ew_customer_id === focusCustomerId) : undefined),
		[data, focusCustomerId],
	);
	const [focusHandled, setFocusHandled] = useState(false);
	if (focused && !focusHandled) {
		setFocusHandled(true);
		setFollowUp(focused);
	}

	function resetPaging() {
		setPage(0);
		setSelectedIds(new Set());
	}

	function toggle(row: EwLeadRowType) {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(row.ew_customer_id)) next.delete(row.ew_customer_id);
			else next.add(row.ew_customer_id);
			return next;
		});
	}

	function toggleAll() {
		setSelectedIds((prev) =>
			prev.size === sendable.length ? new Set() : new Set(sendable.map((r) => r.ew_customer_id)),
		);
	}

	async function handleSend() {
		if (!dbName || !schema || !branch?.id || selectedRows.length === 0) return;
		setSending(true);
		try {
			// One mutation per stage — the server's constraint, not the user's. Sequential:
			// each call is capped server-side, and a burst would only race the same cap.
			const byStage = new Map<number, number[]>();
			for (const row of selectedRows) {
				if (row.due_stage == null) continue;
				const ids = byStage.get(row.due_stage) ?? [];
				ids.push(row.ew_customer_id);
				byStage.set(row.due_stage, ids);
			}

			const results: EwSendResultType[] = [];
			for (const stage of [...byStage.keys()].sort((a, b) => b - a)) {
				const outcome = await sendEwReminders(dbName, schema, branch.id, byStage.get(stage) ?? [], stage);
				// The feature switch is global — the first disabled answer settles it.
				if (outcome.disabled) {
					toast.info(MESSAGES.INFO_EW_DISABLED);
					return;
				}
				results.push(...outcome.results);
			}

			const sent = results.filter((r) => r.status === "SENT").length;
			const failed = results.filter((r) => r.status === "FAILED").length;
			const capped = results.filter((r) => r.status === "CAPPED").length;
			const skipped = results.filter((r) => r.status === "SKIPPED").length;

			if (sent > 0) toast.success(`${sent} reminder${sent === 1 ? "" : "s"} sent.`);
			if (capped > 0) toast.info(`${capped} not sent — daily send cap reached.`);
			if (skipped > 0) toast.info(`${skipped} skipped — already sent, or no valid mobile.`);
			if (failed > 0) toast.error(`${failed} failed to send.`);

			setSelectedIds(new Set());
			refetch();
			onChanged();
		} catch {
			toast.error(MESSAGES.ERROR_EW_SEND_FAILED);
		} finally {
			setSending(false);
		}
	}

	async function handleDelete() {
		if (!deletingCustomer || !dbName || !schema) return;
		try {
			await apolloClient.mutate({
				mutation: GRAPHQL_MAP.genericUpdate,
				variables: {
					db_name: dbName,
					schema,
					value: graphQlUtils.buildGenericUpdateValue({
						deletedIds: [deletingCustomer.ew_customer_id],
						tableName: "ew_customer",
						xData: {},
					}),
				},
			});
			toast.success("Customer deleted.");
			setDeletingCustomer(null);
			refetch();
			onChanged();
		} catch {
			toast.error(MESSAGES.ERROR_EW_CUSTOMERS_LOAD_FAILED);
		}
	}

	// The edit dialog wants the customer shape, not the lead row.
	function toCustomer(row: EwLeadRowType): EwCustomerType {
		return {
			address: row.address,
			brand_id: row.brand_id,
			brand_name: row.brand_name,
			city: row.city,
			days_left: row.days_left,
			email: row.email,
			follow_up_count: row.follow_up_count,
			full_name: row.full_name,
			id: row.ew_customer_id,
			interest_count: row.interest_count,
			is_active: true,
			is_opted_out: row.is_opted_out,
			last_sent_at: row.sent_at,
			last_stage_sent: row.stage,
			mobile: row.mobile,
			model_name: row.product_label,
			outcome: row.outcome,
			outcome_at: row.outcome_at,
			product_id: row.product_id,
			product_name: row.product_label,
			purchase_date: row.purchase_date,
			remarks: row.remarks,
			serial_no: row.serial_no,
			warranty_end_date: row.warranty_end_date,
		};
	}

	const total = data[0]?.total_count ?? data.length;

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3">
			{/* Filters */}
			{/* Search left, primary action right — adding a lead is the one thing on
			    this screen that creates data, so it gets the weight. */}
			<div className="flex flex-wrap items-center justify-between gap-2">
				<Input
					className="max-w-xs"
					onChange={(e) => {
						setSearch(e.target.value);
						resetPaging();
					}}
					placeholder="Search name, mobile, brand, model or serial no"
					value={search}
				/>
				<Button
					className="bg-teal-600 font-semibold text-white shadow-sm hover:bg-teal-700"
					onClick={() => {
						setEditingCustomer(null);
						setLeadDialogOpen(true);
					}}
				>
					<Plus className="mr-1.5 size-4" />
					New Lead
				</Button>
			</div>

			<div className="flex flex-wrap gap-1.5">
				{STATUS_PILLS.map((pill) => (
					<button
						key={pill.label}
						className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
							status === pill.value
								? "border-(--cl-accent) bg-(--cl-surface-2) text-(--cl-text)"
								: "border-(--cl-border) text-(--cl-text-muted) hover:text-(--cl-text)"
						}`}
						onClick={() => {
							setStatus(pill.value);
							resetPaging();
						}}
						type="button"
					>
						{pill.label}
					</button>
				))}
			</div>

			<div className="flex flex-wrap items-center gap-1.5">
				<span className="text-xs text-(--cl-text-muted)">Expiring:</span>
				{buckets.map((b) => (
					<button
						key={b.label}
						className={`cursor-pointer rounded-md border px-2 py-0.5 text-xs transition-colors ${
							bucket === b.value
								? "border-(--cl-accent) bg-(--cl-surface-2) text-(--cl-text)"
								: "border-(--cl-border) text-(--cl-text-muted) hover:text-(--cl-text)"
						}`}
						onClick={() => {
							setBucket(bucket === b.value ? null : b.value);
							resetPaging();
						}}
						type="button"
					>
						{b.label}
					</button>
				))}
			</div>

			{/* Send bar — only meaningful while something sendable is picked */}
			{selectedIds.size > 0 && (
				<div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-(--cl-border) bg-(--cl-surface-2) px-3 py-2">
					<p className="text-xs text-(--cl-text-muted)">{selectedIds.size} selected</p>
					<Button disabled={sending} onClick={() => void handleSend()} size="sm">
						<Send className="mr-1.5 size-3.5" />
						{sending ? "Sending…" : "Send reminders"}
					</Button>
				</div>
			)}

			{loading && <ReportLoading />}
			{error && <ReportError message={MESSAGES.ERROR_EW_CUSTOMERS_LOAD_FAILED} onRetry={refetch} />}
			{!loading && !error && data.length === 0 && <ReportEmpty />}

			{!loading && !error && data.length > 0 && (
				<div className="min-h-0 flex-1 overflow-auto rounded-lg border border-(--cl-border)">
					<table className="w-full min-w-[1040px] text-sm">
						<thead className="sticky top-0 bg-(--cl-surface-2)">
							<tr className="text-left text-xs font-bold tracking-tight text-(--cl-text)">
								<th className="w-10 px-3 py-2">
									<Checkbox
										aria-label="Select all due"
										checked={allSelected}
										className={EW_CHECKBOX_CLASS}
										disabled={sendable.length === 0}
										onCheckedChange={toggleAll}
									/>
								</th>
								<th className="px-3 py-2">Customer</th>
								<th className="px-3 py-2">Device</th>
								<th className="px-3 py-2">Warranty ends</th>
								<th className="px-3 py-2">Sent</th>
								<th className="px-3 py-2">Status</th>
								<th className="px-3 py-2" />
							</tr>
						</thead>
						<tbody>
							{data.map((row) => {
								const canSend = row.due_stage != null && !!row.mobile && isValidMobile(row.mobile);
								return (
									<tr
										key={row.ew_customer_id}
										className="cursor-pointer border-t border-(--cl-border) hover:bg-(--cl-hover)"
										onClick={() => setDetail(row)}
									>
										<td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
											<Checkbox
												aria-label={`Select ${row.full_name}`}
												checked={selectedIds.has(row.ew_customer_id)}
												className={EW_CHECKBOX_CLASS}
												disabled={!canSend}
												onCheckedChange={() => toggle(row)}
											/>
										</td>
										<td className="px-3 py-2">
											<div className="font-medium text-(--cl-text)">{row.full_name}</div>
											<div className="text-xs text-(--cl-text-muted)">
												{row.mobile}
												{!!row.mobile && !isValidMobile(row.mobile) && (
													<span className="ml-2 text-red-600">invalid number</span>
												)}
												{row.is_opted_out && <span className="ml-2">· opted out</span>}
											</div>
										</td>
										<td className="px-3 py-2">
											<div className="text-(--cl-text-muted)">
												{[row.brand_name, row.product_label].filter(Boolean).join(" · ") || "-"}
											</div>
											{row.serial_no && (
												<div className="text-xs text-(--cl-text-muted)">SN {row.serial_no}</div>
											)}
										</td>
										<td className="px-3 py-2">
											<div className="text-(--cl-text)">{formatDate(row.warranty_end_date)}</div>
											<div className="text-xs text-(--cl-text-muted)">
												{daysLeftLabel(row.days_left)}
											</div>
										</td>
										<td className="px-3 py-2">
											<EwSendHistory sends={row.sends} />
										</td>
										<td className="px-3 py-2">
											<div className="text-(--cl-text)">{leadStatusLabel(row)}</div>
											<div className="text-xs text-(--cl-text-muted)">
												{row.due_stage != null
													? `${stageLabel(row.due_stage)} reminder due`
													: row.stage != null && row.stage_status
														? EW_STAGE_STATUS_LABEL[row.stage_status]
														: EW_OUTCOME_LABEL[row.outcome]}
												{row.follow_up_count > 0 ? ` · ${row.follow_up_count} follow-up` : ""}
											</div>
										</td>
										<td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
											<div className="flex justify-end gap-1">
												<Button
													onClick={() => setFollowUp(row)}
													size="sm"
													title="Record a call or close this lead"
													variant="ghost"
												>
													<PhoneCall className="size-3.5" />
												</Button>
												<Button
													onClick={() => {
														setEditingCustomer(toCustomer(row));
														setLeadDialogOpen(true);
													}}
													size="sm"
													title="Edit"
													variant="ghost"
												>
													<Pencil className="size-3.5" />
												</Button>
												<Button
													onClick={() => setDeletingCustomer(row)}
													size="sm"
													title="Delete"
													variant="ghost"
												>
													<Trash2 className="size-3.5" />
												</Button>
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}

			{total > PAGE_SIZE && (
				<div className="flex items-center justify-end gap-2 text-xs text-(--cl-text-muted)">
					<span>
						{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
					</span>
					<Button disabled={page === 0} onClick={() => setPage((p) => p - 1)} size="sm" variant="outline">
						Previous
					</Button>
					<Button
						disabled={(page + 1) * PAGE_SIZE >= total}
						onClick={() => setPage((p) => p + 1)}
						size="sm"
						variant="outline"
					>
						Next
					</Button>
				</div>
			)}

			<EwCustomerDialog
				editing={editingCustomer}
				onOpenChange={setLeadDialogOpen}
				onSuccess={() => {
					setLeadDialogOpen(false);
					refetch();
					onChanged();
				}}
				open={leadDialogOpen}
			/>

			<EwFollowUpDialog
				customerName={followUp?.full_name ?? ""}
				daysLeft={followUp?.days_left ?? null}
				ewCustomerId={followUp?.ew_customer_id ?? 0}
				onClose={() => setFollowUp(null)}
				onSaved={() => {
					refetch();
					onChanged();
				}}
				open={!!followUp}
				stage={followUp?.stage ?? focusStage ?? null}
				statusLabel={followUp ? leadStatusLabel(followUp) : null}
				warrantyEndDate={followUp?.warranty_end_date ?? null}
			/>

			<EwLeadDetailDialog
				lead={detail}
				onClose={() => setDetail(null)}
				onFollowUp={(row) => {
					setDetail(null);
					setFollowUp(row);
				}}
				onChanged={() => {
					refetch();
					onChanged();
				}}
				stages={stages}
			/>

			<AlertDialog open={!!deletingCustomer} onOpenChange={(v) => !v && setDeletingCustomer(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{MESSAGES.CONFIRM_EW_DELETE_TITLE}</AlertDialogTitle>
						<AlertDialogDescription>{MESSAGES.CONFIRM_EW_DELETE_BODY}</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={() => void handleDelete()}>Delete</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
};
