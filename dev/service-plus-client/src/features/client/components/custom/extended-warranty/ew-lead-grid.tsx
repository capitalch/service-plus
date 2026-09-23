import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import {
	Ban,
	ChevronLeft,
	ChevronRight,
	MessageSquare,
	PlayCircle,
	SearchIcon,
	ThumbsDown,
	ThumbsUp,
	Trophy,
	UserPlus,
} from "lucide-react";

import { RefreshButton } from "@/components/shared/refresh-button";
import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { SEARCH_DEBOUNCE_MS } from "@/constants/timing";
import type { EwLeadRowType, EwLeadsFilterType, EwStateType } from "@/features/client/types/extended-warranty";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import { selectCurrentBranch } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

import { ReportEmpty } from "../../reports/common/report-empty";
import { ReportError } from "../../reports/common/report-error";
import { ReportLoading } from "../../reports/common/report-loading";
import { useGenericQuery } from "../../reports/common/use-generic-query";
import { EwDeliveryChip } from "./ew-delivery-chip";
import { EwLeadActionsMenu } from "./ew-lead-actions-menu";
import { EwStateBadge } from "./ew-state-badge";
import {
	EW_BANDS,
	EW_COLOR_CLASSES,
	EW_FOLLOW_UP_ACTIONS,
	EW_STATE_META,
	EW_STATES,
	daysLeftLabel,
	formatDate,
	formatDateTime,
	isCompleteMobile,
	isFollowUpDue,
	sendBlockReason,
} from "./ew-state-machine";
import type { EwLeadActionsType } from "./use-ew-lead-actions";

// Selecting leads to send is this grid's main action, so its boxes are bigger and carry the
// teal accent rather than the default hairline square. [&_svg] beats the tick's own colour.
const CHECKBOX =
	"size-[18px] cursor-pointer border-2 border-teal-500/70 bg-white hover:border-teal-600 hover:bg-teal-50 data-checked:border-teal-600 data-checked:bg-teal-600 dark:bg-transparent dark:hover:bg-teal-950/40 dark:data-checked:bg-teal-600 [&_svg]:size-3.5 [&_svg]:text-white";
// One icon + colour per state for the filter dropdown — the exact same icons and literal
// classes ew-lead-actions-menu.tsx uses for its transition items (also mirrored in
// constants/icon-colors.ts), so the two menus never show the same state in two colours.
const STATE_VISUAL: Record<EwStateType, { color: string; icon: ComponentType<{ className?: string }> }> = {
	CANCELLED: { color: "text-rose-600", icon: Ban },
	IN_PROGRESS: { color: "text-violet-600", icon: PlayCircle },
	INTERESTED: { color: "text-orange-600", icon: ThumbsUp },
	LOST: { color: "text-amber-600", icon: ThumbsDown },
	MESSAGE_SENT: { color: "text-indigo-600", icon: MessageSquare },
	NEW_LEAD: { color: "text-blue-600", icon: UserPlus },
	WON: { color: "text-emerald-600", icon: Trophy },
};

const PAGE_SIZE = 50;
// The customer is no longer asked how to be reached — the shop always calls — so CALL is
// the unremarkable default and gets no label. Only WHATSAPP, left over from a lead that
// chose it before the chooser was removed, is worth a line: it is the exception.
const TH =
	"whitespace-nowrap px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-(--cl-text-muted)";
const TD = "px-3 py-2 align-top";

type Props = {
	actions: EwLeadActionsType;
	filter: EwLeadsFilterType;
	refreshKey: number;
	/** Details tab: adds the state filter and the "Show closed" switch. */
	showStateFilter?: boolean;
};

/**
 * The shared lead grid (§C7.7) — Details tab and every dashboard drill-down. Newest entered
 * first (a "follow-ups due" drill-down orders by next follow-up). Only sendable leads get a
 * checkbox; the send bar sends the selection through the shared confirm.
 */
export const EwLeadGrid = ({ actions, filter, refreshKey, showStateFilter = false }: Props) => {
	const branch = useAppSelector(selectCurrentBranch);
	const [page, setPage] = useState(0);
	const [search, setSearch] = useState("");
	const [selected, setSelected] = useState<Set<number>>(new Set());
	const [showClosed, setShowClosed] = useState(true);
	const [stateFilter, setStateFilter] = useState<EwStateType | "ALL">("ALL");
	const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS);

	const {
		data: rows,
		error,
		loading,
		refetch,
	} = useGenericQuery<EwLeadRowType>({
		enabled: !!branch?.id,
		sqlArgs: {
			band: filter.band ?? null,
			branch_id: branch?.id ?? null,
			follow_up_due: filter.followUpDue ?? null,
			is_closed: filter.isClosed ?? (showStateFilter && !showClosed ? false : null),
			limit: PAGE_SIZE,
			message_group: filter.messageGroup ?? null,
			offset: page * PAGE_SIZE,
			progress_stage: filter.progressStage ?? null,
			search: debouncedSearch.trim() || null,
			state: filter.state ?? (stateFilter === "ALL" ? null : stateFilter),
		},
		sqlId: SQL_MAP.GET_EW_LEADS_PAGED,
	});

	// Re-read after any change (an action, or a live WhatsApp status); keep the page.
	const firstRef = useRef(true);
	useEffect(() => {
		if (firstRef.current) {
			firstRef.current = false;
			return;
		}
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setSelected(new Set());
		refetch();
	}, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

	const total = rows[0]?.total_count ?? 0;
	const sendable = rows.filter((r) => sendBlockReason(r) === null);
	const selectedRows = sendable.filter((r) => selected.has(r.ew_lead_id));
	const allSelected = sendable.length > 0 && selectedRows.length === sendable.length;

	function changePage(next: number) {
		setPage(next);
		setSelected(new Set());
	}

	function resetPaging() {
		setPage(0);
		setSelected(new Set());
	}

	function toggle(id: number, checked: boolean) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (checked) next.add(id);
			else next.delete(id);
			return next;
		});
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2">
				<div className="relative w-full sm:w-72">
					<SearchIcon className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-(--cl-text-muted)" />
					<Input
						className="pl-8"
						placeholder="Name, mobile, serial, model, brand"
						value={search}
						onChange={(e) => {
							setSearch(e.target.value);
							resetPaging();
						}}
					/>
				</div>
				{showStateFilter && (
					<>
						<Select
							value={stateFilter}
							onValueChange={(v) => {
								setStateFilter(v as EwStateType | "ALL");
								resetPaging();
							}}
						>
							<SelectTrigger className="w-44">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="ALL">All states</SelectItem>
								{EW_STATES.map((s) => {
									const { color, icon: Icon } = STATE_VISUAL[s];
									return (
										<SelectItem key={s} value={s}>
											<span className="flex items-center gap-1.5">
												<Icon className={cn("size-3.5", color)} />
												{EW_STATE_META[s].label}
											</span>
										</SelectItem>
									);
								})}
							</SelectContent>
						</Select>
						<Label className="flex items-center gap-2 text-xs font-normal" htmlFor="ew-show-closed">
							<Switch
								checked={showClosed}
								id="ew-show-closed"
								onCheckedChange={(v) => {
									setShowClosed(v);
									resetPaging();
								}}
							/>
							Show closed
						</Label>
					</>
				)}
				<RefreshButton className="ml-auto" loading={loading} onClick={refetch} />
			</div>

			{selectedRows.length > 0 && (
				<div className="flex flex-wrap items-center gap-3 rounded-lg border border-teal-300 bg-teal-50 px-3 py-2 text-sm dark:bg-teal-950/30">
					<span className="font-semibold text-teal-900 dark:text-teal-200">
						{selectedRows.length} selected
					</span>
					<Button
						className="bg-teal-600 text-white hover:bg-teal-700"
						size="sm"
						onClick={() => actions.sendMany(selectedRows)}
					>
						<WhatsAppIcon className="h-4 w-4" />
						Send WhatsApp reminder
					</Button>
					<Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
						Clear
					</Button>
				</div>
			)}

			{error ? (
				<ReportError message={MESSAGES.ERROR_EW_LEADS_LOAD_FAILED} onRetry={refetch} />
			) : loading && rows.length === 0 ? (
				<ReportLoading lines={6} />
			) : rows.length === 0 ? (
				<ReportEmpty message={MESSAGES.INFO_EW_NO_LEADS} />
			) : (
				<div className="min-h-0 flex-1 overflow-auto rounded-lg border border-(--cl-border)">
					<table className="w-full min-w-[1400px] border-collapse text-xs">
						<thead className="sticky top-0 z-10 bg-(--cl-surface-2)">
							<tr className="border-b border-(--cl-border)">
								<th className={cn(TH, "w-10")}>
									<Checkbox
										aria-label="Select all sendable leads on this page"
										className={CHECKBOX}
										checked={allSelected}
										disabled={sendable.length === 0}
										onCheckedChange={(checked) =>
											setSelected(
												checked === true
													? new Set(sendable.map((r) => r.ew_lead_id))
													: new Set(),
											)
										}
									/>
								</th>
								<th className={TH}>Entered</th>
								<th className={TH}>Customer</th>
								<th className={TH}>Contact</th>
								<th className={TH}>Device</th>
								<th className={TH}>Purchased</th>
								<th className={TH}>Warranty ends</th>
								<th className={TH}>Messages</th>
								<th className={TH}>Interest</th>
								<th className={TH}>Follow-up</th>
								<th className={TH}>Staff note</th>
								<th className={cn(TH, "sticky right-0 bg-(--cl-surface-2)")} />
							</tr>
						</thead>
						<tbody>
							{rows.map((row) => {
								const canSend = sendBlockReason(row) === null;
								const band = EW_COLOR_CLASSES[EW_BANDS[row.band].color];
								const due = isFollowUpDue(row);
								return (
									<tr
										key={row.ew_lead_id}
										className="cursor-pointer border-b border-(--cl-border) text-(--cl-text) even:bg-(--cl-surface-2)/40 hover:bg-(--cl-hover)"
										onClick={() => actions.openDetail(row.ew_lead_id)}
									>
										<td className={TD} onClick={(e) => e.stopPropagation()}>
											{canSend && (
												<Checkbox
													aria-label={`Select ${row.full_name}`}
													className={CHECKBOX}
													checked={selected.has(row.ew_lead_id)}
													onCheckedChange={(checked) =>
														toggle(row.ew_lead_id, checked === true)
													}
												/>
											)}
										</td>
										<td className={TD}>
											<div className="whitespace-nowrap">{formatDate(row.created_at)}</div>
											{row.created_by_name && (
												<div className="text-(--cl-text-muted)">{row.created_by_name}</div>
											)}
										</td>
										<td className={TD}>
											<div className="font-semibold">{row.full_name}</div>
											<div className={cn(!isCompleteMobile(row.mobile) && "text-red-600")}>
												{row.mobile}
												{!isCompleteMobile(row.mobile) && " · invalid number"}
											</div>
											{row.is_opted_out && (
												<span className="mt-0.5 inline-block rounded border border-slate-400 px-1 text-[10px] text-(--cl-text-muted)">
													opted out
												</span>
											)}
										</td>
										<td className={cn(TD, "max-w-56 text-(--cl-text-muted)")}>
											{row.email && <div className="truncate">{row.email}</div>}
											{row.address && (
												<div className="truncate" title={row.address}>
													{row.address}
												</div>
											)}
											{row.city && <div>{row.city}</div>}
										</td>
										<td className={cn(TD, "max-w-56")}>
											<div className="truncate">
												{[row.brand_name, row.product_label].filter(Boolean).join(" · ")}
											</div>
											{row.serial_no && (
												<div className="text-(--cl-text-muted)">SN {row.serial_no}</div>
											)}
										</td>
										<td className={cn(TD, "whitespace-nowrap")}>
											<div>{formatDate(row.purchase_date)}</div>
											<EwStateBadge row={row} />
										</td>
										<td className={cn(TD, "whitespace-nowrap")}>
											<div>{formatDate(row.warranty_end_date)}</div>
											<div className="text-(--cl-text-muted)">{daysLeftLabel(row.days_left)}</div>
											<span
												className={cn(
													"mt-0.5 inline-block rounded border px-1 text-[10px] font-semibold",
													band.border,
													band.text,
													band.tint,
												)}
											>
												{EW_BANDS[row.band].label}
											</span>
										</td>
										<td className={cn(TD, "whitespace-nowrap")}>
											<div className="flex items-center gap-1">
												<EwDeliveryChip
													error={row.last_error}
													status={row.last_delivery_status}
												/>
												{row.message_count > 1 && (
													<span className="text-(--cl-text-muted)">×{row.message_count}</span>
												)}
											</div>
											{row.last_sent_at && (
												<div className="text-(--cl-text-muted)">
													{formatDateTime(row.last_sent_at)}
												</div>
											)}
										</td>
										<td className={cn(TD, "max-w-48")}>
											{row.interest_at ? (
												<>
													<div className="whitespace-nowrap">
														{formatDateTime(row.interest_at)}
													</div>
													{row.preferred_contact === "WHATSAPP" && (
														<div className="text-(--cl-text-muted)">Prefers WhatsApp</div>
													)}
													{/* Labelled and quoted: the Remarks column further right is the
													    staff's own note, and an unlabelled line here reads as that. */}
													{row.customer_remarks && (
														<div
															className="mt-0.5 line-clamp-2 italic text-(--cl-text)"
															title={row.customer_remarks}
														>
															Said: “{row.customer_remarks}”
														</div>
													)}
												</>
											) : (
												<span className="text-(--cl-text-muted)">—</span>
											)}
										</td>
										<td className={cn(TD, "max-w-52")}>
											<div className="whitespace-nowrap">{row.follow_up_count}</div>
											{row.last_follow_up_at && (
												<div className="whitespace-nowrap text-(--cl-text-muted)">
													Last {formatDateTime(row.last_follow_up_at)}
												</div>
											)}
											{/* What the staff member actually did and said, not just the count
											    and dates above — the only place this was visible before was
											    inside the lead's own detail dialog. */}
											{(row.last_follow_up_by_name || row.last_follow_up_notes) && (
												<div
													className="mt-0.5 line-clamp-2 text-(--cl-text)"
													title={row.last_follow_up_notes ?? undefined}
												>
													{row.last_follow_up_action && (
														<span className="font-semibold">
															{EW_FOLLOW_UP_ACTIONS[row.last_follow_up_action].label}
															{" · "}
														</span>
													)}
													{row.last_follow_up_notes}
													{row.last_follow_up_by_name && (
														<span className="text-(--cl-text-muted)">
															{" — "}
															{row.last_follow_up_by_name}
														</span>
													)}
												</div>
											)}
											{row.next_follow_up_at && (
												<div
													className={cn(
														"whitespace-nowrap",
														due
															? "font-semibold text-amber-700 dark:text-amber-400"
															: "text-(--cl-text-muted)",
													)}
												>
													{due ? "Due · " : "Next "}
													{formatDateTime(row.next_follow_up_at)}
												</div>
											)}
										</td>
										<td className={cn(TD, "max-w-48 text-(--cl-text-muted)")}>
											{row.remarks && (
												<div className="truncate" title={row.remarks}>
													{row.remarks}
												</div>
											)}
										</td>
										<td
											className={cn(TD, "sticky right-0 bg-(--cl-surface-2)")}
											onClick={(e) => e.stopPropagation()}
										>
											<EwLeadActionsMenu row={row} onAction={actions.handleAction} />
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}

			{total > 0 && (
				<div className="flex items-center justify-end gap-2 text-xs text-(--cl-text-muted)">
					<span>
						{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
					</span>
					<Button disabled={page === 0} size="sm" variant="outline" onClick={() => changePage(page - 1)}>
						<ChevronLeft className="h-3.5 w-3.5" />
						Previous
					</Button>
					<Button
						disabled={(page + 1) * PAGE_SIZE >= total}
						size="sm"
						variant="outline"
						onClick={() => changePage(page + 1)}
					>
						Next
						<ChevronRight className="h-3.5 w-3.5" />
					</Button>
				</div>
			)}
		</div>
	);
};
