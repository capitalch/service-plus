import { useCallback, useEffect, useState } from "react";
import { FileClock, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
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
import { RefreshButton } from "@/components/shared/refresh-button";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { selectCurrentUser, selectDbName } from "@/features/auth/store/auth-slice";
import { formatDateShort } from "@/features/client/components/reports/common/formatters";
import { isGstDivision } from "@/features/client/types/division";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj, graphQlUtils } from "@/lib/graphql-utils";
import { selectAvailableDivisions, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import type { Job } from "@/types/db-schema-service";

import { fmtCurrency } from "../deliver-job/deliver-job-helpers";
import type { JobDeliveryFullDetail } from "../deliver-job/deliver-job-schema";
import { buildJobInvoicePayload, type ShowPartsInInvoiceSettingType } from "../deliver-job/job-invoice-builder";

// One-time screen (plans/plan-fix-warranty-charges.md, Step 10): invoices delivered warranty
// jobs that carry a real amount but were never invoiced. Remove it, with its sidebar item,
// once every tenant has run it.

type GenericQueryData<T> = { genericQuery: T[] | null };

type MissingInvoiceRowType = Pick<Job, "amount" | "branch_id" | "delivery_date" | "division_id" | "id" | "job_no"> & {
	branch_name: string;
	customer_name: string;
	division_name: string | null;
	line_count: number;
	lines_selling_total: number;
};

type RowStatusType = "LINES_ZERO" | "NO_LINES" | "READY";

type ConfirmTargetType = "ALL" | MissingInvoiceRowType | null;

function rowStatus(row: MissingInvoiceRowType): RowStatusType {
	if (Number(row.line_count) === 0) return "NO_LINES";
	if (!(Number(row.lines_selling_total) > 0)) return "LINES_ZERO";
	return "READY";
}

export const WarrantyInvoiceBackfillSection = () => {
	const availableDivisions = useAppSelector(selectAvailableDivisions);
	const currentUser = useAppSelector(selectCurrentUser);
	const dbName = useAppSelector(selectDbName);
	const schema = useAppSelector(selectSchema);
	const isAdmin = currentUser?.userType === "A" || currentUser?.userType === "S";

	const [confirmTarget, setConfirmTarget] = useState<ConfirmTargetType>(null);
	const [creatingJobId, setCreatingJobId] = useState<number | null>(null);
	const [loading, setLoading] = useState(false);
	const [rows, setRows] = useState<MissingInvoiceRowType[]>([]);
	const [runningAll, setRunningAll] = useState(false);
	const [showPartsSetting, setShowPartsSetting] = useState<ShowPartsInInvoiceSettingType | null>(null);

	const loadRows = useCallback(async () => {
		if (!dbName || !schema) return;
		setLoading(true);
		try {
			const [rowsRes, settingRes] = await Promise.all([
				apolloClient.query<GenericQueryData<MissingInvoiceRowType>>({
					fetchPolicy: "network-only",
					query: GRAPHQL_MAP.genericQuery,
					variables: {
						db_name: dbName,
						schema,
						value: graphQlUtils.buildGenericQueryValue({
							sqlId: SQL_MAP.GET_WARRANTY_JOBS_MISSING_INVOICE,
						}),
					},
				}),
				apolloClient.query<GenericQueryData<{ setting_value: unknown }>>({
					fetchPolicy: "network-only",
					query: GRAPHQL_MAP.genericQuery,
					variables: {
						db_name: dbName,
						schema,
						value: graphQlUtils.buildGenericQueryValue({
							sqlArgs: { setting_key: "show_parts_in_job_invoice" },
							sqlId: SQL_MAP.GET_APP_SETTING_BY_KEY,
						}),
					},
				}),
			]);
			setRows(rowsRes.data?.genericQuery ?? []);
			const sv = settingRes.data?.genericQuery?.[0]?.setting_value;
			setShowPartsSetting(sv != null && typeof sv === "object" ? (sv as ShowPartsInInvoiceSettingType) : null);
		} catch {
			toast.error(MESSAGES.ERROR_WARRANTY_BACKFILL_LOAD_FAILED);
		} finally {
			setLoading(false);
		}
	}, [dbName, schema]);

	useEffect(() => {
		void loadRows();
	}, [loadRows]);

	// Builds the invoice exactly as Deliver Job does (same detail query, same builder) and
	// sends it to createBackfillJobInvoice. The server sets the date, branch and W number.
	async function createInvoice(row: MissingInvoiceRowType): Promise<boolean> {
		if (!dbName || !schema) return false;
		const division = availableDivisions.find((d) => d.id === row.division_id) ?? null;
		if (!division) {
			toast.error(`Job #${row.job_no}: ${MESSAGES.ERROR_WARRANTY_BACKFILL_DIVISION_MISSING}`);
			return false;
		}
		setCreatingJobId(row.id);
		try {
			const res = await apolloClient.query<GenericQueryData<JobDeliveryFullDetail>>({
				fetchPolicy: "network-only",
				query: GRAPHQL_MAP.genericQuery,
				variables: {
					db_name: dbName,
					schema,
					value: graphQlUtils.buildGenericQueryValue({
						sqlArgs: { job_ids: [row.id] },
						sqlId: SQL_MAP.GET_DELIVERABLE_JOBS_DETAIL_MULTI,
					}),
				},
			});
			const job = res.data?.genericQuery?.[0];
			if (!job) {
				toast.error(`Job #${row.job_no}: ${MESSAGES.ERROR_WARRANTY_BACKFILL_CREATE_FAILED}`);
				return false;
			}
			const built = buildJobInvoicePayload(job, isGstDivision(division), job.is_igst ?? false, showPartsSetting);
			if (!built.ok) {
				const warning =
					built.reason === "NO_LINES"
						? MESSAGES.WARN_JOB_INVOICE_NO_LINES
						: MESSAGES.WARN_JOB_INVOICE_LINES_ZERO;
				toast.warning(`Job #${row.job_no}: ${warning}`);
				return false;
			}
			const { aggregate, amount, cgst_amount, igst_amount, lines, sgst_amount } = built.payload;
			await apolloClient.mutate({
				mutation: GRAPHQL_MAP.createBackfillJobInvoice,
				variables: {
					db_name: dbName,
					schema,
					value: encodeObj({
						tableName: "job_invoice",
						xData: {
							aggregate,
							amount,
							cgst_amount,
							igst_amount,
							job_id: row.id,
							sgst_amount,
							supply_state_code: division.gst_state_code ?? "",
							xDetails: [{ fkeyName: "job_invoice_id", tableName: "job_invoice_line", xData: lines }],
						},
					}),
				},
			});
			return true;
		} catch (err) {
			console.error("Backfill invoice error:", err);
			toast.error(`Job #${row.job_no}: ${MESSAGES.ERROR_WARRANTY_BACKFILL_CREATE_FAILED}`);
			return false;
		} finally {
			setCreatingJobId(null);
		}
	}

	async function handleConfirm() {
		const target = confirmTarget;
		setConfirmTarget(null);
		if (!target) return;
		if (target === "ALL") {
			setRunningAll(true);
			let created = 0;
			for (const row of rows.filter((r) => rowStatus(r) === "READY")) {
				if (await createInvoice(row)) created++;
			}
			setRunningAll(false);
			toast.success(`${MESSAGES.SUCCESS_WARRANTY_BACKFILL_DONE} ${created} invoice(s) created.`);
		} else if (await createInvoice(target)) {
			toast.success(`${MESSAGES.SUCCESS_WARRANTY_BACKFILL_DONE} Job #${target.job_no} invoiced.`);
		}
		await loadRows();
	}

	const busy = runningAll || creatingJobId !== null;
	const readyCount = rows.filter((r) => rowStatus(r) === "READY").length;

	return (
		<motion.div
			animate={{ opacity: 1 }}
			className="flex min-h-0 flex-1 flex-col overflow-y-auto"
			initial={{ opacity: 0 }}
			transition={{ duration: 0.25 }}
		>
			{/* Header */}
			<div className="flex flex-wrap items-center gap-3 border-b border-(--cl-border) bg-(--cl-surface) px-4 py-2">
				<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-(--cl-accent)/10 text-(--cl-accent)">
					<FileClock className="h-4 w-4 text-orange-600" />
				</div>
				<h1 className="text-lg font-bold text-(--cl-text)">Warranty Invoice Backfill</h1>
				<div className="ml-auto flex items-center gap-2">
					<Button
						disabled={!isAdmin || busy || readyCount === 0}
						size="sm"
						onClick={() => setConfirmTarget("ALL")}
					>
						{runningAll && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
						Create All ({readyCount})
					</Button>
					<RefreshButton disabled={busy} loading={loading} onClick={() => void loadRows()} />
				</div>
			</div>

			{/* Body */}
			<div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6 sm:px-6">
				<p className="text-sm text-(--cl-text-muted)">{MESSAGES.INFO_WARRANTY_BACKFILL_INTRO}</p>

				{loading ? (
					<div className="flex h-40 items-center justify-center">
						<Loader2 className="h-6 w-6 animate-spin text-(--cl-text-muted)" />
					</div>
				) : rows.length === 0 ? (
					<p className="py-12 text-center text-sm text-(--cl-text-muted)">
						{MESSAGES.INFO_WARRANTY_BACKFILL_EMPTY}
					</p>
				) : (
					<div className="overflow-x-auto rounded-xl border border-(--cl-border) bg-(--cl-surface)">
						<table className="w-full min-w-[44rem] text-sm">
							<thead className="bg-(--cl-surface-2) text-xs uppercase tracking-wide text-(--cl-text-muted)">
								<tr>
									<th className="px-3 py-2.5 text-left font-medium">Job No</th>
									<th className="px-3 py-2.5 text-left font-medium">Customer</th>
									<th className="px-3 py-2.5 text-left font-medium">Delivered</th>
									<th className="px-3 py-2.5 text-left font-medium">Branch</th>
									<th className="px-3 py-2.5 text-right font-medium">Amount</th>
									<th className="px-3 py-2.5 text-right font-medium">Lines Total</th>
									<th className="px-3 py-2.5 text-left font-medium">Status</th>
									<th className="px-3 py-2.5" />
								</tr>
							</thead>
							<tbody>
								{rows.map((row) => {
									const status = rowStatus(row);
									return (
										<tr key={row.id} className="border-t border-(--cl-border)">
											<td className="px-3 py-2 font-mono font-semibold text-(--cl-accent)">
												{row.job_no}
											</td>
											<td className="px-3 py-2 text-(--cl-text)">{row.customer_name}</td>
											<td className="whitespace-nowrap px-3 py-2 text-(--cl-text)">
												{formatDateShort(row.delivery_date)}
											</td>
											<td className="px-3 py-2 text-(--cl-text-muted)">{row.branch_name}</td>
											<td className="px-3 py-2 text-right tabular-nums">
												{fmtCurrency(Number(row.amount))}
											</td>
											<td className="px-3 py-2 text-right tabular-nums">
												{fmtCurrency(Number(row.lines_selling_total))}
											</td>
											<td className="px-3 py-2">
												{status === "READY" ? (
													<span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
														Ready
													</span>
												) : (
													<span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
														{status === "NO_LINES"
															? MESSAGES.INFO_WARRANTY_BACKFILL_STATUS_NO_LINES
															: MESSAGES.INFO_WARRANTY_BACKFILL_STATUS_LINES_ZERO}
													</span>
												)}
											</td>
											<td className="px-3 py-2 text-right">
												{status === "READY" && (
													<Button
														className="whitespace-nowrap"
														disabled={!isAdmin || busy}
														size="sm"
														variant="outline"
														onClick={() => setConfirmTarget(row)}
													>
														{creatingJobId === row.id && (
															<Loader2 className="mr-1 h-4 w-4 animate-spin" />
														)}
														Create Invoice
													</Button>
												)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>

			<AlertDialog open={confirmTarget !== null} onOpenChange={(open) => !open && setConfirmTarget(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{confirmTarget === "ALL"
								? `Create ${readyCount} invoice(s)`
								: `Invoice job #${confirmTarget?.job_no ?? ""}`}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{confirmTarget === "ALL"
								? MESSAGES.INFO_WARRANTY_BACKFILL_CONFIRM_ALL
								: MESSAGES.INFO_WARRANTY_BACKFILL_CONFIRM_ONE}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={() => void handleConfirm()}>Create</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</motion.div>
	);
};
