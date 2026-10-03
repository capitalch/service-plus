// Admin and Super Admin only: GET_BU_PAYMENTS is an admin-only sqlId (plans/plan.md Step 14),
// so this lives outside components/shared, which non-admin screens may use.
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SQL_MAP } from "@/constants/sql-map";
import { useGenericQuery } from "@/features/client/components/reports/common/use-generic-query";
import { displayDate, inr, periodText } from "@/components/shared/billing/billing-dates";

type PaymentRowType = {
	amount_paise: number;
	bu_code: string | null;
	entry_kind: "correction" | "extension" | "fee_rebase" | "payment";
	id: number;
	monthly_fee_paise: number;
	months: number;
	note: string | null;
	payment_mode: string | null;
	payment_reference: string | null;
	period_from: string | null;
	period_to: string | null;
	received_on: string | null;
	recorded_at: string;
	recorded_by: string;
};

type PaymentHistoryDialogPropsType = {
	/** The BU, or null for every row of the database (an Enterprise client). */
	buId: number | null;
	dbName: string;
	onOpenChange: (open: boolean) => void;
	title: string;
};

const KIND_LABELS: Record<PaymentRowType["entry_kind"], string> = {
	correction: "Correction",
	extension: "Extension",
	fee_rebase: "Plan/fee changed",
	payment: "Payment",
};

const thClass = "text-xs font-semibold uppercase tracking-wide text-slate-500";

/** The payment ledger, newest first. Rows are never edited; fee changes show as their own rows. */
export const PaymentHistoryDialog = ({ buId, dbName, onOpenChange, title }: PaymentHistoryDialogPropsType) => {
	const query = useGenericQuery<PaymentRowType>({
		dbName,
		schema: "security",
		sqlArgs: { bu_id: buId },
		sqlId: SQL_MAP.GET_BU_PAYMENTS,
	});

	return (
		<Dialog open onOpenChange={onOpenChange}>
			<DialogContent aria-describedby={undefined} className="sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle className="text-base font-semibold">Payment history — {title}</DialogTitle>
				</DialogHeader>
				<div className="max-h-[60vh] overflow-auto">
					<Table>
						<TableHeader>
							<TableRow className="bg-slate-50 hover:bg-slate-50">
								<TableHead className={thClass}>Recorded</TableHead>
								<TableHead className={thClass}>Entry</TableHead>
								<TableHead className={thClass}>Period</TableHead>
								<TableHead className={`${thClass} text-right`}>Amount</TableHead>
								<TableHead className={thClass}>Details</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{query.data.length === 0 ? (
								<TableRow>
									<TableCell className="py-8 text-center text-sm text-slate-400" colSpan={5}>
										{query.loading ? "Loading…" : "No payments yet."}
									</TableCell>
								</TableRow>
							) : (
								query.data.map((row) => (
									<TableRow className="align-top" key={row.id}>
										<TableCell className="whitespace-nowrap text-xs text-slate-500">
											{displayDate(row.recorded_at)}
											<p>{row.recorded_by}</p>
										</TableCell>
										<TableCell className="text-sm">
											{KIND_LABELS[row.entry_kind]}
											{row.bu_code && (
												<p className="font-mono text-[11px] text-slate-400">{row.bu_code}</p>
											)}
										</TableCell>
										<TableCell className="whitespace-nowrap text-xs text-slate-600">
											{row.entry_kind === "payment" ? (
												<>
													{periodText(row.months)}
													<p>
														{displayDate(row.period_from)} – {displayDate(row.period_to)}
													</p>
												</>
											) : row.period_to ? (
												<>to {displayDate(row.period_to)}</>
											) : (
												"—"
											)}
										</TableCell>
										<TableCell className="whitespace-nowrap text-right text-sm">
											{row.entry_kind === "payment" ? inr(row.amount_paise) : "—"}
										</TableCell>
										<TableCell className="max-w-72 text-xs text-slate-600">
											{row.entry_kind === "payment" && (
												<p>
													{row.payment_mode} · {row.payment_reference} ·{" "}
													{displayDate(row.received_on)}
												</p>
											)}
											{row.note && <p>{row.note}</p>}
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>
			</DialogContent>
		</Dialog>
	);
};
