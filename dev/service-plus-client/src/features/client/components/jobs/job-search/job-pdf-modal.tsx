import { useEffect, useRef, useState } from "react";
import { Loader2, Package, Printer, ReceiptText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import type { JobDetailType, JobTransactionRow } from "@/features/client/types/job";

type Props = {
    jobId:   number;
    onClose: () => void;
};

type GenericQueryData<T> = { genericQuery: T[] | null };

type PartUsedRow = {
    id:         number;
    part_code:  string;
    part_name:  string;
    uom:        string;
    quantity:   number;
    sale_price: number | null;
    remarks:    string | null;
};

type AdditionalChargeRow = {
    id:            number;
    charge_name:   string;
    ref_no:        string | null;
    description:   string | null;
    selling_price: number;
};

function fmt(val: number | null | undefined) {
    if (val == null) return "—";
    return `₹${Number(val).toFixed(2)}`;
}

const PRINT_STYLE_ID = "__job_pdf_print_style";

export const JobPdfModal = ({ jobId, onClose }: Props) => {
    const dbName        = useAppSelector(selectDbName);
    const schema        = useAppSelector(selectSchema);
    const currentBranch = useAppSelector(selectCurrentBranch);

    const [job,          setJob]          = useState<JobDetailType | null>(null);
    const [transactions, setTransactions] = useState<JobTransactionRow[]>([]);
    const [parts,        setParts]        = useState<PartUsedRow[]>([]);
    const [charges,      setCharges]      = useState<AdditionalChargeRow[]>([]);
    const [loading,      setLoading]      = useState(true);

    const printRegionId = useRef(`job-pdf-region-${jobId}`);

    useEffect(() => {
        if (!dbName || !schema) return;
        const gq = (sqlId: string, sqlArgs?: Record<string, unknown>) =>
            apolloClient.query<GenericQueryData<unknown>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName, schema,
                    value: graphQlUtils.buildGenericQueryValue({ sqlId, sqlArgs }),
                },
            });
        Promise.all([
            gq(SQL_MAP.GET_JOB_DETAIL, { id: jobId }),
            gq(SQL_MAP.GET_JOB_TRANSACTIONS_BY_JOB, { job_id: jobId }),
            gq(SQL_MAP.GET_JOB_PART_USED_BY_JOB, { job_id: jobId }),
            gq(SQL_MAP.GET_JOB_ADDITIONAL_CHARGES_BY_JOB, { job_id: jobId }),
        ]).then(([jobRes, tranRes, partsRes, chargesRes]) => {
            setJob((jobRes.data?.genericQuery?.[0] ?? null) as JobDetailType | null);
            setTransactions((tranRes.data?.genericQuery ?? []) as JobTransactionRow[]);
            setParts((partsRes.data?.genericQuery ?? []) as PartUsedRow[]);
            setCharges((chargesRes.data?.genericQuery ?? []) as AdditionalChargeRow[]);
        }).catch(() => {
            toast.error("Failed to load job details.");
        }).finally(() => {
            setLoading(false);
        });
    }, [dbName, schema, jobId]);

    function handlePrint() {
        const rid = printRegionId.current;
        const existing = document.getElementById(PRINT_STYLE_ID);
        if (existing) existing.remove();
        const style = document.createElement("style");
        style.id = PRINT_STYLE_ID;
        style.textContent = `
            @media print {
                body * { visibility: hidden !important; }
                #${rid}, #${rid} * { visibility: visible !important; }
                #${rid} {
                    position: fixed !important;
                    inset: 0 !important;
                    width: 100% !important;
                    padding: 24px 32px !important;
                    background: white !important;
                    overflow: visible !important;
                }
            }
        `;
        document.head.appendChild(style);
        window.print();
        style.remove();
    }

    const device = job
        ? [job.product_name, job.brand_name, job.model_name].filter(Boolean).join(" / ") || null
        : null;

    const partsSelling   = parts.reduce((s, p) => s + (Number(p.sale_price ?? 0) * Number(p.quantity)), 0);
    const chargesSelling = charges.reduce((s, c) => s + Number(c.selling_price ?? 0), 0);
    const grandTotal     = partsSelling + chargesSelling;

    const rid = printRegionId.current;

    return (
        <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
            <DialogContent className="sm:max-w-2xl max-h-[95vh] flex flex-col overflow-hidden bg-white p-0">
                {/* ── Modal toolbar (hidden on print) ── */}
                <DialogHeader className="flex flex-row items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
                    <DialogTitle className="text-base font-bold text-slate-900">
                        {job ? `Job Report — #${job.job_no}` : "Job Report"}
                    </DialogTitle>
                    <Button
                        className="h-8 gap-1.5 px-3 text-xs font-semibold"
                        disabled={loading || !job}
                        size="sm"
                        onClick={handlePrint}
                    >
                        <Printer className="h-3.5 w-3.5" />
                        Print / Save PDF
                    </Button>
                </DialogHeader>

                {/* ── Scrollable print area ── */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex h-48 items-center justify-center gap-2 text-sm text-slate-500">
                            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
                        </div>
                    ) : !job ? (
                        <div className="flex h-48 items-center justify-center text-sm text-slate-500">
                            Job not found.
                        </div>
                    ) : (
                        <div id={rid} className="p-6 space-y-4 bg-white text-black font-sans text-[14px] leading-snug">

                            {/* ── Page header ── */}
                            <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
                                <div>
                                    <h1 className="text-xl font-extrabold tracking-tight text-slate-900 uppercase">Service Report</h1>
                                    {currentBranch?.name && (
                                        <p className="mt-0.5 text-xs text-slate-500">{currentBranch.name}</p>
                                    )}
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-extrabold font-mono text-slate-900">#{job.job_no}</div>
                                    <div className="mt-0.5 text-xs text-slate-500">Date: {job.job_date}</div>
                                </div>
                            </div>

                            {/* Status badges */}
                            <div className="flex flex-wrap gap-2">
                                <span className="rounded border border-slate-300 px-2.5 py-0.5 text-xs font-bold text-slate-700">{job.job_status_name}</span>
                                <span className="rounded border border-slate-300 px-2.5 py-0.5 text-xs font-bold text-slate-700">{job.job_type_name}</span>
                                {job.is_closed && (
                                    <span className="rounded border border-emerald-400 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800">CLOSED</span>
                                )}
                            </div>

                            {/* ── Customer + Device ── */}
                            <div className="grid grid-cols-2 gap-4">
                                <Section title="Customer">
                                    <p className="font-bold text-slate-900">{job.customer_name ?? "—"}</p>
                                    <p className="text-sm text-slate-600">{job.mobile}</p>
                                    {job.address_snapshot && (
                                        <p className="mt-1 text-xs text-slate-500 leading-relaxed">{job.address_snapshot}</p>
                                    )}
                                </Section>
                                <Section title="Device">
                                    {device && <p className="font-bold text-slate-900">{device}</p>}
                                    <div className="mt-1 flex flex-wrap gap-1.5">
                                        {job.serial_no && (
                                            <Chip>{`S/N: ${job.serial_no}`}</Chip>
                                        )}
                                        {job.warranty_card_no && (
                                            <Chip>{`Warranty: ${job.warranty_card_no}`}</Chip>
                                        )}
                                        <Chip>{`Qty: ${job.quantity}`}</Chip>
                                    </div>
                                </Section>
                            </div>

                            {/* ── Service details grid ── */}
                            <Section title="Service Details">
                                <div className="grid grid-cols-3 gap-x-6 gap-y-2 mt-1">
                                    {([
                                        ["Technician",    job.technician_name],
                                        ["Amount",        fmt(job.amount)],
                                        ["Estimate",      fmt(job.estimate_amount)],
                                        ["Delivery Date", job.delivery_date],
                                        ["Receive Mode",  job.job_receive_manner_name],
                                        ["Condition",     job.job_receive_condition_name],
                                    ] as [string, string | null | undefined][]).filter(([, v]) => v != null).map(([label, value]) => (
                                        <div key={label} className="border-b border-slate-100 pb-1">
                                            <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
                                            <div className="text-sm font-semibold text-slate-800">{value}</div>
                                        </div>
                                    ))}
                                </div>
                            </Section>

                            {/* ── Narrative blocks ── */}
                            {([
                                ["Problem Reported", job.problem_reported],
                                ["Diagnosis",        job.diagnosis],
                                ["Work Done",        job.work_done],
                                ["Remarks",          job.remarks],
                            ] as [string, string | null | undefined][])
                                .filter(([, v]) => (v ?? "").trim())
                                .map(([label, value]) => (
                                    <Section key={label} title={label}>
                                        <p className="whitespace-pre-wrap text-sm text-slate-800 leading-relaxed">{value}</p>
                                    </Section>
                                ))}

                            {/* ── Parts Used ── */}
                            {parts.length > 0 && (
                                <div className="rounded border border-slate-200 overflow-hidden">
                                    <SectionHeader icon={<Package className="h-3.5 w-3.5" />} title="Parts Used" />
                                    <table className="min-w-full border-collapse">
                                        <thead>
                                            <THead cols={["#", "Code", "Part Name", "UOM", "Qty", "Unit Price", "Total"]} />
                                        </thead>
                                        <tbody>
                                            {parts.map((p, i) => (
                                                <tr key={p.id} className="border-b border-slate-100 odd:bg-white even:bg-slate-50/60">
                                                    <TD mono>{i + 1}</TD>
                                                    <TD mono>{p.part_code}</TD>
                                                    <TD>{p.part_name}</TD>
                                                    <TD small>{p.uom}</TD>
                                                    <TD right>{Number(p.quantity).toFixed(2)}</TD>
                                                    <TD right small>{fmt(p.sale_price)}</TD>
                                                    <TD right bold>{p.sale_price != null ? fmt(Number(p.sale_price) * Number(p.quantity)) : "—"}</TD>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* ── Additional Charges ── */}
                            {charges.length > 0 && (
                                <div className="rounded border border-slate-200 overflow-hidden">
                                    <SectionHeader icon={<ReceiptText className="h-3.5 w-3.5" />} title="Additional Charges" />
                                    <table className="min-w-full border-collapse">
                                        <thead>
                                            <THead cols={["#", "Charge Name", "Ref No", "Description", "Amount"]} />
                                        </thead>
                                        <tbody>
                                            {charges.map((c, i) => (
                                                <tr key={c.id} className="border-b border-slate-100 odd:bg-white even:bg-slate-50/60">
                                                    <TD mono>{i + 1}</TD>
                                                    <TD bold>{c.charge_name}</TD>
                                                    <TD small>{c.ref_no || "—"}</TD>
                                                    <TD>{c.description || "—"}</TD>
                                                    <TD right bold>{fmt(c.selling_price)}</TD>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* ── Transaction History ── */}
                            <div className="rounded border border-slate-200 overflow-hidden">
                                <SectionHeader title="Transaction History" />
                                {transactions.length === 0 ? (
                                    <p className="p-3 text-xs text-slate-400 italic">No transactions recorded.</p>
                                ) : (
                                    <table className="min-w-full border-collapse">
                                        <thead>
                                            <THead cols={["#", "Date", "Status", "Technician", "Amount", "Remarks"]} />
                                        </thead>
                                        <tbody>
                                            {transactions.map((t, i) => (
                                                <tr key={t.id} className="border-b border-slate-100 odd:bg-white even:bg-slate-50/60">
                                                    <TD mono>{i + 1}</TD>
                                                    <TD mono small>{t.performed_at?.slice(0, 10) ?? "—"}</TD>
                                                    <TD bold>{t.status_name ?? "—"}</TD>
                                                    <TD>{t.technician_name ?? "—"}</TD>
                                                    <TD right>{fmt(t.amount)}</TD>
                                                    <TD small>{t.remarks ?? "—"}</TD>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            {/* ── Totals summary ── */}
                            {(parts.length > 0 || charges.length > 0) && grandTotal > 0 && (
                                <div className="flex justify-end">
                                    <div className="rounded border border-slate-300 p-3 min-w-[180px] space-y-1">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Summary</div>
                                        {parts.length > 0 && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-600">Parts</span>
                                                <span className="font-semibold tabular-nums">{fmt(partsSelling)}</span>
                                            </div>
                                        )}
                                        {charges.length > 0 && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-600">Charges</span>
                                                <span className="font-semibold tabular-nums">{fmt(chargesSelling)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between border-t border-slate-300 pt-1 text-sm font-extrabold">
                                            <span className="text-slate-800">Grand Total</span>
                                            <span className="tabular-nums text-slate-900">{fmt(grandTotal)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── Page footer ── */}
                            <div className="border-t border-slate-200 pt-3 text-center">
                                <p className="text-[10px] text-slate-400">
                                    Generated on {new Date().toLocaleString()}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

// ─── Print-safe sub-components ────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded border border-slate-200 p-3">
            <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</div>
            {children}
        </div>
    );
}

function SectionHeader({ icon, title }: { icon?: React.ReactNode; title: string }) {
    return (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
            {icon && <span className="text-slate-500">{icon}</span>}
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{title}</span>
        </div>
    );
}

function Chip({ children }: { children: React.ReactNode }) {
    return (
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-700">
            {children}
        </span>
    );
}

function THead({ cols }: { cols: string[] }) {
    return (
        <tr className="bg-slate-50">
            {cols.map(h => (
                <th key={h} className="px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200">
                    {h}
                </th>
            ))}
        </tr>
    );
}

function TD({
    children, mono, small, right, bold,
}: {
    children: React.ReactNode;
    mono?:  boolean;
    small?: boolean;
    right?: boolean;
    bold?:  boolean;
}) {
    return (
        <td className={[
            "px-3 py-2 border-b border-slate-100",
            mono  ? "font-mono" : "",
            small ? "text-xs text-slate-500" : "text-sm text-slate-800",
            right ? "text-right tabular-nums" : "",
            bold  ? "font-semibold" : "",
        ].join(" ")}>
            {children}
        </td>
    );
}
