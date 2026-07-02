import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { selectAvailableDivisions, selectCurrentDivision, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import type { JobDetailType } from "@/features/client/types/job";
import {
    downloadProformaInvoicePdf,
    getProformaInvoiceBlobUrl,
    type ProformaChargeRow,
    type ProformaPartRow,
} from "./job-proforma-invoice-pdf-gen";

type Props = {
    jobId:   number;
    onClose: () => void;
};

type GenericQueryData<T> = { genericQuery: T[] | null };

type LoadedData = {
    job:     JobDetailType;
    parts:   ProformaPartRow[];
    charges: ProformaChargeRow[];
};

export const JobProformaInvoiceModal = ({ jobId, onClose }: Props) => {
    const dbName             = useAppSelector(selectDbName);
    const schema             = useAppSelector(selectSchema);
    const availableDivisions = useAppSelector(selectAvailableDivisions);
    const currentDivision    = useAppSelector(selectCurrentDivision);

    const [data,    setData]    = useState<LoadedData | null>(null);
    const [pdfUrl,  setPdfUrl]  = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        if (!dbName || !schema) return;
        let createdUrl: string | null = null;
        let cancelled = false;

        const gq = (sqlId: string, sqlArgs?: Record<string, unknown>) =>
            apolloClient.query<GenericQueryData<unknown>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName, schema,
                    value: graphQlUtils.buildGenericQueryValue({ sqlId, sqlArgs }),
                },
            });

        async function process() {
            setLoading(true);
            try {
                const [jobRes, partsRes, chargesRes] = await Promise.all([
                    gq(SQL_MAP.GET_JOB_DETAIL,                    { id: jobId }),
                    gq(SQL_MAP.GET_JOB_PART_USED_BY_JOB,          { job_id: jobId }),
                    gq(SQL_MAP.GET_JOB_ADDITIONAL_CHARGES_BY_JOB, { job_id: jobId }),
                ]);
                if (cancelled) return;
                const job     = (jobRes.data?.genericQuery?.[0] ?? null) as JobDetailType | null;
                if (!job) { toast.error("Job not found."); return; }
                const parts   = (partsRes.data?.genericQuery   ?? []) as ProformaPartRow[];
                const charges = (chargesRes.data?.genericQuery ?? []) as ProformaChargeRow[];
                const division = availableDivisions.find(d => d.id === job.division_id) ?? currentDivision ?? null;

                createdUrl = getProformaInvoiceBlobUrl(job, parts, charges, division);
                setData({ job, parts, charges });
                setPdfUrl(createdUrl);
            } catch {
                if (!cancelled) toast.error("Failed to generate proforma invoice.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        void process();

        return () => { cancelled = true; if (createdUrl) URL.revokeObjectURL(createdUrl); };
    }, [dbName, schema, jobId, availableDivisions, currentDivision]);

    const division = data
        ? (availableDivisions.find(d => d.id === data.job.division_id) ?? currentDivision ?? null)
        : null;

    function handleDownload() {
        if (!data) return;
        downloadProformaInvoicePdf(data.job, data.parts, data.charges, division);
    }

    function handlePrint() {
        iframeRef.current?.contentWindow?.print();
    }

    return (
        <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
            <DialogContent
                aria-describedby={undefined}
                className="sm:max-w-5xl h-[95vh] flex flex-col p-0 overflow-hidden bg-white"
            >
                <DialogHeader className="flex flex-row items-center justify-between border-b border-slate-200 px-5 py-3 pr-12 shrink-0">
                    <DialogTitle className="text-base font-bold text-slate-900">
                        {data ? `Proforma Invoice — #${data.job.job_no}` : "Proforma Invoice"}
                    </DialogTitle>
                    <div className="flex items-center gap-2">
                        <Button
                            className="h-8 gap-1.5 px-3 text-xs font-semibold"
                            disabled={!pdfUrl}
                            size="sm"
                            variant="outline"
                            onClick={handleDownload}
                        >
                            <Download className="h-3.5 w-3.5" />
                            Download
                        </Button>
                        <Button
                            className="h-8 gap-1.5 px-3 text-xs font-semibold"
                            disabled={!pdfUrl}
                            size="sm"
                            onClick={handlePrint}
                        >
                            <Printer className="h-3.5 w-3.5" />
                            Print / Save PDF
                        </Button>
                    </div>
                </DialogHeader>

                <div className="flex-1 w-full bg-slate-100 flex items-center justify-center">
                    {loading ? (
                        <div className="flex flex-col items-center gap-3 text-slate-500">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                            <p className="text-sm font-medium animate-pulse">Generating proforma invoice…</p>
                        </div>
                    ) : pdfUrl ? (
                        <iframe
                            ref={iframeRef}
                            className="h-full w-full border-none"
                            src={pdfUrl}
                            title="Proforma Invoice PDF Preview"
                        />
                    ) : (
                        <div className="text-sm italic text-slate-400">
                            Failed to load preview. Try downloading instead.
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
