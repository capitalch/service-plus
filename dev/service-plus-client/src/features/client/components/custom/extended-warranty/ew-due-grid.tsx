import { Fragment, useMemo, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import type { EwDueRowType } from "@/features/client/types/extended-warranty";
import { isValidMobile } from "@/lib/mobile";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

import { ReportEmpty } from "../../reports/common/report-empty";
import { ReportError } from "../../reports/common/report-error";
import { ReportLoading } from "../../reports/common/report-loading";
import { useGenericQuery } from "../../reports/common/use-generic-query";
import { daysLeftLabel, formatDate, stageLabel } from "./extended-warranty-helpers";
import { sendEwReminders } from "./send-ew-reminders";

// How far past expiry a record stays eligible, mirroring _EW_GRACE_DAYS on the server.
const GRACE_DAYS = -7;

type Props = { onSent: () => void; stages: number[] };

/**
 * Customers who have fallen into a reminder bucket and not yet been sent that stage.
 * The bucket is chosen server-side (the SMALLEST configured stage the customer has
 * reached), so a row's `stage` is authoritative — this grid never computes it.
 */
export const EwDueGrid = ({ onSent, stages }: Props) => {
	const branch = useAppSelector(selectCurrentBranch);
	const dbName = useAppSelector(selectDbName);
	const schema = useAppSelector(selectSchema);

	const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
	const [sending, setSending] = useState(false);

	const { data, error, loading, refetch } = useGenericQuery<EwDueRowType>({
		enabled: !!branch?.id && stages.length > 0,
		sqlArgs: { branch_id: branch?.id ?? null, grace_days: GRACE_DAYS, stages },
		sqlId: SQL_MAP.GET_EW_DUE_CUSTOMERS,
	});

	// An invalid mobile is shown but never selectable — the send would only fail, and
	// hiding the row would hide a record that needs its number fixed.
	const selectable = useMemo(() => data.filter((row) => !!row.mobile && isValidMobile(row.mobile)), [data]);

	// One send covers one stage, because the message text and the once-per-stage guard
	// are both keyed by it. Selecting across stages would need N sends, so the grid
	// pins the selection to the stage of the first row picked.
	const selectedStage = useMemo(() => {
		const first = data.find((row) => selectedIds.has(row.ew_customer_id));
		return first?.stage ?? null;
	}, [data, selectedIds]);

	function toggle(row: EwDueRowType) {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(row.ew_customer_id)) next.delete(row.ew_customer_id);
			else next.add(row.ew_customer_id);
			return next;
		});
	}

	function toggleAllInStage(stage: number) {
		const idsInStage = selectable.filter((r) => r.stage === stage).map((r) => r.ew_customer_id);
		setSelectedIds((prev) => {
			const allSelected = idsInStage.every((id) => prev.has(id));
			return allSelected ? new Set() : new Set(idsInStage);
		});
	}

	async function handleSend() {
		if (!dbName || !schema || !branch?.id || selectedStage == null) return;
		setSending(true);
		try {
			const outcome = await sendEwReminders(dbName, schema, branch.id, [...selectedIds], selectedStage);
			if (outcome.disabled) {
				toast.info(MESSAGES.INFO_EW_DISABLED);
				return;
			}
			const sent = outcome.results.filter((r) => r.status === "SENT").length;
			const failed = outcome.results.filter((r) => r.status === "FAILED").length;
			const capped = outcome.results.filter((r) => r.status === "CAPPED").length;
			const skipped = outcome.results.filter((r) => r.status === "SKIPPED").length;

			if (sent > 0) toast.success(`${sent} reminder${sent === 1 ? "" : "s"} sent.`);
			if (capped > 0) toast.info(`${capped} not sent — daily send cap reached.`);
			if (skipped > 0) toast.info(`${skipped} skipped — already sent, or no valid mobile.`);
			if (failed > 0) toast.error(`${failed} failed to send.`);

			setSelectedIds(new Set());
			refetch();
			onSent();
		} catch {
			toast.error(MESSAGES.ERROR_EW_SEND_FAILED);
		} finally {
			setSending(false);
		}
	}

	if (loading) return <ReportLoading />;
	if (error) return <ReportError message={MESSAGES.ERROR_EW_DUE_LOAD_FAILED} onRetry={refetch} />;
	if (data.length === 0) return <ReportEmpty message={MESSAGES.INFO_EW_NO_DUE_REMINDERS} />;

	const groups = stages
		.map((stage) => ({ rows: data.filter((r) => r.stage === stage), stage }))
		.filter((g) => g.rows.length > 0);

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className="text-xs text-(--cl-text-muted)">
					{selectedIds.size > 0
						? `${selectedIds.size} selected · ${stageLabel(selectedStage ?? 0)} reminder`
						: MESSAGES.INFO_EW_SELECT_CUSTOMERS}
				</p>
				<Button
					disabled={selectedIds.size === 0 || sending || selectedStage == null}
					onClick={handleSend}
					size="sm"
				>
					<Send className="mr-1.5 size-3.5" />
					{sending ? "Sending…" : "Send reminders"}
				</Button>
			</div>

			<div className="min-h-0 flex-1 overflow-auto rounded-lg border border-(--cl-border)">
				<table className="w-full min-w-[820px] text-sm">
					<tbody>
						{groups.map(({ rows, stage }) => (
							<Fragment key={stage}>
								<tr className="bg-(--cl-surface-2)">
									<th className="w-10 px-3 py-2">
										<Checkbox
											aria-label={`Select all ${stageLabel(stage)}`}
											checked={
												rows.length > 0 &&
												rows
													.filter((r) => !!r.mobile && isValidMobile(r.mobile))
													.every((r) => selectedIds.has(r.ew_customer_id))
											}
											onCheckedChange={() => toggleAllInStage(stage)}
										/>
									</th>
									<th
										className="px-3 py-2 text-left text-xs font-bold tracking-tight text-(--cl-text)"
										colSpan={6}
									>
										{stageLabel(stage)} reminder · {rows.length}
									</th>
								</tr>
								{rows.map((row) => {
									const sendable = !!row.mobile && isValidMobile(row.mobile);
									return (
										<tr
											key={`${row.ew_customer_id}-${row.stage}`}
											className="border-t border-(--cl-border) hover:bg-(--cl-hover)"
										>
											<td className="px-3 py-2">
												<Checkbox
													aria-label={`Select ${row.full_name}`}
													checked={selectedIds.has(row.ew_customer_id)}
													disabled={!sendable}
													onCheckedChange={() => toggle(row)}
												/>
											</td>
											<td className="px-3 py-2 font-medium text-(--cl-text)">{row.full_name}</td>
											<td className="px-3 py-2 text-(--cl-text-muted)">
												{row.mobile}
												{!sendable && (
													<span className="ml-2 text-[11px] text-red-600">
														invalid number
													</span>
												)}
											</td>
											<td className="px-3 py-2 text-(--cl-text-muted)">
												{row.brand_name ?? "-"}
											</td>
											<td className="px-3 py-2 text-(--cl-text-muted)">
												{row.model_name || row.product_name || "-"}
											</td>
											<td className="px-3 py-2 text-(--cl-text-muted)">
												{formatDate(row.warranty_end_date)}
											</td>
											<td className="px-3 py-2 text-(--cl-text-muted)">
												{daysLeftLabel(row.days_left)}
											</td>
										</tr>
									);
								})}
							</Fragment>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
};
