import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";

import { ChartCard } from "../common/chart-card";
import { formatDateShort } from "../common/formatters";
import { formatIsoDate, getRange } from "../common/fiscal";
import type { DateRangeType } from "../common/fiscal";
import { ReportEmpty } from "../common/report-empty";
import { ReportError } from "../common/report-error";
import { ReportLoading } from "../common/report-loading";
import { ReportSection } from "../common/report-section";
import { ReportTable } from "../common/report-table";
import type { ReportColumnType } from "../common/report-table";
import { ReportToolbar } from "../common/report-toolbar";
import { exportReportPdf } from "../common/pdf-export";
import { exportReportXlsx } from "../common/xlsx-export";
import { useFiscalSetting } from "../common/use-fiscal-setting";
import { useGenericQuery } from "../common/use-generic-query";
import { StatusText } from "../../jobs/job-badges";

type RowType = {
    id: number;
    job_no: string;
    remarks: string | null;
    status_code: string | null;
    status_name: string | null;
    technician_name: string | null;
    transaction_date: string;
};

const COLUMNS: ReportColumnType<RowType>[] = [
    {
        cell:   r => formatDateShort(r.transaction_date),
        header: "Date",
        id:     "date",
        sortValue: r => r.transaction_date,
        value:  r => r.transaction_date,
        width:  "120px",
    },
    {
        cell:   r => <span className="font-mono text-(--cl-accent-text)">{r.job_no}</span>,
        header: "Job No",
        id:     "job_no",
        value:  r => r.job_no,
        width:  "110px",
    },
    {
        cell:   r => <StatusText code={r.status_code} name={r.status_name} />,
        header: "Status",
        id:     "status",
        value:  r => r.status_name ?? "—",
        width:  "150px",
    },
    {
        cell:   r => r.technician_name ?? "—",
        header: "Technician",
        id:     "tech",
        value:  r => r.technician_name ?? "",
        width:  "140px",
    },
    {
        header: "Remarks",
        id:     "remarks",
        value:  r => r.remarks ?? "",
    },
];

export const JobTransactionLedgerSection = () => {
    const { fyStartMonth, isReady } = useFiscalSetting();

    const initialRange = useMemo<DateRangeType>(
        () => getRange("thisMonth", new Date(), fyStartMonth),
        [fyStartMonth],
    );
    const [range, setRange] = useState<DateRangeType>(initialRange);
    const [jobNoFilter, setJobNoFilter] = useState("");

    const rangeArgs = useMemo(() => ({
        from: formatIsoDate(range.from),
        to:   formatIsoDate(range.to),
    }), [range]);

    const q = useGenericQuery<RowType>({
        enabled: isReady,
        sqlArgs: rangeArgs,
        sqlId:   SQL_MAP.GET_JOB_TRANSACTION_LEDGER_RANGE,
    });

    const filteredRows = useMemo(() => {
        const needle = jobNoFilter.trim().toLowerCase();
        if (!needle) return q.data;
        return q.data.filter(r => r.job_no.toLowerCase().includes(needle));
    }, [q.data, jobNoFilter]);

    function handlePdfExport() {
        try {
            exportReportPdf({
                columns: [
                    { dataKey: "date",    header: "Date",       width: 24 },
                    { dataKey: "job_no",  header: "Job No",     width: 22 },
                    { dataKey: "status",  header: "Status",     width: 30 },
                    { dataKey: "tech",    header: "Technician", width: 28 },
                    { dataKey: "remarks", header: "Remarks" },
                ],
                fileName:    `job-transaction-ledger_${rangeArgs.from}_${rangeArgs.to}`,
                meta:        [{ label: "Range", value: `${rangeArgs.from} → ${rangeArgs.to}` }],
                orientation: "landscape",
                rows: filteredRows.map(r => ({
                    date:    formatDateShort(r.transaction_date),
                    job_no:  r.job_no,
                    remarks: r.remarks ?? "",
                    status:  r.status_name ?? "",
                    tech:    r.technician_name ?? "",
                })),
                subtitle:    "Complete job transaction log",
                title:       "Job Transaction Ledger",
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    function handleXlsxExport() {
        try {
            exportReportXlsx({
                fileName: `job-transaction-ledger_${rangeArgs.from}_${rangeArgs.to}`,
                sheets: [{
                    name: "Transactions",
                    rows: filteredRows.map(r => ({
                        "Date":       formatDateShort(r.transaction_date),
                        "Job No":     r.job_no,
                        "Remarks":    r.remarks ?? "",
                        "Status":     r.status_name ?? "",
                        "Technician": r.technician_name ?? "",
                    })),
                }],
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    return (
        <ReportSection>
            <ReportToolbar
                onExportExcel={handleXlsxExport}
                onExportPdf={handlePdfExport}
                onPrint={() => window.print()}
                onRefresh={q.refetch}
                onSetRange={(key, custom) => setRange(getRange(key, new Date(), fyStartMonth, custom))}
                range={range}
                subtitle="Every transaction logged against any job — sorted by date desc"
                title="Job Transaction Ledger"
            >
                <div className="flex flex-col gap-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-(--cl-text-muted)">
                        Job No
                    </Label>
                    <div className="relative w-52">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                        <Input
                            className="h-9 pl-8 pr-8"
                            onChange={e => setJobNoFilter(e.target.value)}
                            placeholder="Search job no..."
                            value={jobNoFilter}
                        />
                        {jobNoFilter && (
                            <button
                                aria-label="Clear job no filter"
                                className="absolute right-2.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-(--cl-text-muted) text-(--cl-surface) hover:bg-(--cl-text) focus:outline-none"
                                onClick={() => setJobNoFilter("")}
                                type="button"
                            >
                                <X className="h-2.5 w-2.5" />
                            </button>
                        )}
                    </div>
                </div>
            </ReportToolbar>

            {q.error && <ReportError onRetry={q.refetch} />}

            <ChartCard description="Click a column header to sort" title="Transactions">
                {q.loading
                    ? <ReportLoading lines={4} />
                    : filteredRows.length === 0
                        ? <ReportEmpty />
                        : (
                            <ReportTable
                                columns={COLUMNS}
                                rowKey={r => r.id}
                                rows={filteredRows}
                                showRowIndex
                                stickyHeader={false}
                            />
                        )
                }
            </ChartCard>
        </ReportSection>
    );
};
