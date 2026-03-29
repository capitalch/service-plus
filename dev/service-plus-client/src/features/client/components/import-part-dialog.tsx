import { useCallback, useRef, useState } from "react";
import { read, utils } from "xlsx";
import { AnimatePresence, motion } from "framer-motion";
import {
    AlertCircleIcon,
    CheckCircle2Icon,
    ChevronDownIcon,
    ChevronUpIcon,
    FileSpreadsheetIcon,
    Loader2Icon,
    UploadCloudIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import type { BrandOption } from "@/features/client/types/model";
import type { ImportPartsResult, ParsedPart } from "@/features/client/types/import-parts";

type ImportPartDialogPropsType = {
    brands: BrandOption[];
    db_name: string;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    open: boolean;
    schema: string;
};

const STEP_LABELS = ["Upload", "Map Columns", "Preview", "Validation", "Results"];

const TARGET_FIELDS = [
    { label: "Ignore", value: "ignore" },
    { label: "Part Code *", value: "part_code" },
    { label: "Part Name *", value: "part_name" },
    { label: "Category", value: "category" },
    { label: "Cost Price", value: "cost_price" },
    { label: "Description", value: "part_description" },
    { label: "GST Rate %", value: "gst_rate" },
    { label: "HSN Code", value: "hsn_code" },
    { label: "Model", value: "model" },
    { label: "MRP", value: "mrp" },
    { label: "UOM", value: "uom" },
];

const NUMERIC_FIELDS = new Set(["cost_price", "mrp", "gst_rate"]);

const slideVariants = {
    enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 40 : -40 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -40 : 40 }),
};

const StepIndicator = ({ currentStep }: { currentStep: number }) => (
    <div className="mb-6 flex items-center justify-center gap-1">
        {STEP_LABELS.map((label, idx) => {
            const stepNum = idx + 1;
            const isDone = stepNum < currentStep;
            const isActive = stepNum === currentStep;
            return (
                <div key={label} className="flex items-center gap-1">
                    <div className="flex flex-col items-center gap-0.5">
                        <div
                            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors
                                ${
                                    isActive
                                        ? "bg-teal-600 text-white"
                                        : isDone
                                          ? "bg-teal-100 text-teal-700"
                                          : "bg-[var(--cl-surface-3)] text-[var(--cl-text-muted)]"
                                }`}
                        >
                            {isDone ? <CheckCircle2Icon className="h-3.5 w-3.5" /> : stepNum}
                        </div>
                        <span
                            className={`text-[10px] ${
                                isActive ? "text-teal-600 font-semibold" : "text-[var(--cl-text-muted)]"
                            }`}
                        >
                            {label}
                        </span>
                    </div>
                    {idx < STEP_LABELS.length - 1 && (
                        <div
                            className={`mb-3 h-px w-6 transition-colors ${
                                isDone ? "bg-teal-300" : "bg-[var(--cl-border)]"
                            }`}
                        />
                    )}
                </div>
            );
        })}
    </div>
);

export const ImportPartDialog = ({
    brands,
    db_name,
    onOpenChange,
    onSuccess,
    open,
    schema,
}: ImportPartDialogPropsType) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [brandId, setBrandId] = useState<number | null>(null);
    const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
    const [columns, setColumns] = useState<string[]>([]);
    const [direction, setDirection] = useState(1);
    const [dragOver, setDragOver] = useState(false);
    const [errorsOpen, setErrorsOpen] = useState(false);
    const [validRowsOpen, setValidRowsOpen] = useState(false);
    const [importResult, setImportResult] = useState<ImportPartsResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [previewRows, setPreviewRows] = useState<string[][]>([]);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [step, setStep] = useState(1);
    const [totalRows, setTotalRows] = useState(0);

    const [parsedParts, setParsedParts] = useState<ParsedPart[]>([]);

    function goTo(next: number) {
        setDirection(next > step ? 1 : -1);
        setStep(next);
    }

    function handleClose() {
        resetState();
        onOpenChange(false);
    }

    function resetState() {
        setBrandId(null);
        setColumnMapping({});
        setColumns([]);
        setDirection(1);
        setDragOver(false);
        setErrorsOpen(false);
        setValidRowsOpen(false);
        setImportResult(null);
        setIsLoading(false);
        setPreviewRows([]);
        setSelectedFile(null);
        setStep(1);
        setTotalRows(0);
        setParsedParts([]);
    }

    const handleFileDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragOver(false);
        const dropped = e.dataTransfer.files[0];
        if (dropped) setSelectedFile(dropped);
    }, []);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const picked = e.target.files?.[0];
        if (picked) setSelectedFile(picked);
    }, []);

    const processFile = async () => {
        if (!brandId) {
            toast.error(MESSAGES.ERROR_IMPORT_BRAND_REQUIRED);
            return;
        }
        if (!selectedFile) {
            toast.error(MESSAGES.ERROR_IMPORT_FILE_REQUIRED);
            return;
        }

        setIsLoading(true);
        try {
            const data = await selectedFile.arrayBuffer();
            const workbook = read(data);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json: string[][] = utils.sheet_to_json(worksheet, { header: 1 });

            if (json.length < 1) {
                toast.error("File is empty");
                setIsLoading(false);
                return;
            }

            const headerRow = json[0] || [];
            if (!headerRow.length) {
                toast.error("Header not found");
                setIsLoading(false);
                return;
            }

            const isHeader = headerRow.some((cell) => typeof cell === "string" && isNaN(Number(cell)));
            let cols: string[];
            let dataRows: string[][];

            if (isHeader) {
                cols = headerRow.map((c: any) => String(c).trim());
                dataRows = json.slice(1);
            } else {
                cols = headerRow.map((_: any, i: number) => `Column ${i + 1}`);
                dataRows = json;
            }

            // Ensure all rows have enough cells
            dataRows = dataRows.map((row) => {
                const newRow = [...row];
                while (newRow.length < cols.length) newRow.push("");
                return newRow.map((c) => (c ? String(c).trim() : ""));
            });

            setColumns(cols);
            setPreviewRows(dataRows);
            setTotalRows(dataRows.length);

            // Auto mapping
            const autoMap: Record<string, string> = {};
            for (const col of cols) {
                const match = TARGET_FIELDS.find(
                    (t) => t.value !== "ignore" && t.value === col.toLowerCase().replace(/ /g, "_"),
                );
                autoMap[col] = match ? match.value : "ignore";
            }
            setColumnMapping(autoMap);
            goTo(2);
        } catch (err) {
            console.error(err);
            toast.error(MESSAGES.ERROR_IMPORT_PARSE_ERROR || "Failed to parse file.");
        } finally {
            setIsLoading(false);
        }
    };

    const runValidation = async () => {
        setIsLoading(true);
        try {
            // Fetch existing part codes for this brand ID using apolloClient directly
            const res = await apolloClient.query<{ genericQuery: any[] }>({
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId: SQL_MAP.GET_EXISTING_PART_CODES,
                        sqlArgs: { brand_id: brandId },
                    }),
                },
                fetchPolicy: "no-cache",
            });

            const existingCodesItems: { part_code: string }[] = res.data?.genericQuery || [];
            const existingCodes = new Set(existingCodesItems.map((item) => item.part_code?.toUpperCase()));

            const parts: ParsedPart[] = [];
            let rIdx = 1;

            for (const row of previewRows) {
                const record: Record<string, any> = {};
                const errs: string[] = [];

                columns.forEach((col, idx) => {
                    const target = columnMapping[col];
                    if (target && target !== "ignore") {
                        record[target] = row[idx];
                    }
                });

                let isValid = true;
                const pCode = record["part_code"];
                const pName = record["part_name"];

                if (!pCode) {
                    isValid = false;
                    errs.push("Part Code is required");
                }
                if (!pName) {
                    isValid = false;
                    errs.push("Part Name is required");
                }

                // Check duplicates against DB
                if (pCode && existingCodes.has(String(pCode).toUpperCase())) {
                    isValid = false;
                    errs.push(`Part Code '${pCode}' already exists in this brand`);
                }

                // Numeric validation
                for (const field of Object.keys(record)) {
                    if (NUMERIC_FIELDS.has(field) && record[field]) {
                        const parsed = parseFloat(record[field]);
                        if (isNaN(parsed)) {
                            isValid = false;
                            errs.push(`'${field}' must be a numeric value`);
                        } else {
                            record[field] = parsed; // Store the number
                        }
                    }
                }

                // Prevent intra-file duplicates
                if (pCode) {
                    const intraDup = parts.find(
                        (p) => String(p.part_code).toUpperCase() === String(pCode).toUpperCase(),
                    );
                    if (intraDup) {
                        isValid = false;
                        errs.push(`Duplicate Part Code '${pCode}' found inside file (row ${intraDup.rowNumber})`);
                    }
                }

                parts.push({
                    rowNumber: rIdx,
                    rawData: record,
                    part_code: pCode || "",
                    part_name: pName || "",
                    brand_id: brandId,
                    category: record["category"],
                    part_description: record["part_description"],
                    cost_price: record["cost_price"],
                    mrp: record["mrp"],
                    gst_rate: record["gst_rate"],
                    hsn_code: record["hsn_code"],
                    model: record["model"],
                    uom: record["uom"],
                    isValid,
                    errors: errs,
                });

                rIdx++;
            }

            setParsedParts(parts);
            goTo(4); // Move to Validation step
        } catch (error) {
            console.error("Validation error:", error);
            toast.error("Failed to run validation.");
        } finally {
            setIsLoading(false);
        }
    };

    const doImport = async () => {
        setIsLoading(true);
        try {
            const validParts = parsedParts.filter((p) => p.isValid);

            if (validParts.length > 0) {
                // Batch insert using genericUpdate where xData is a list
                const xDataList = validParts.map((p) => {
                    const rec = {
                        brand_id: brandId,
                        part_code: String(p.part_code).trim(),
                        part_name: String(p.part_name).trim(),
                    } as Record<string, any>;
                    if (p.category) rec.category = p.category;
                    if (p.part_description) rec.part_description = p.part_description;
                    if (typeof p.cost_price === "number") rec.cost_price = p.cost_price;
                    if (typeof p.mrp === "number") rec.mrp = p.mrp;
                    if (typeof p.gst_rate === "number") rec.gst_rate = p.gst_rate;
                    if (p.hsn_code) rec.hsn_code = p.hsn_code;
                    if (p.model) rec.model = p.model;
                    if (p.uom) rec.uom = p.uom;
                    return rec;
                });

                await apolloClient.mutate({
                    mutation: GRAPHQL_MAP.genericUpdate,
                    variables: {
                        db_name,
                        schema,
                        value: graphQlUtils.buildGenericUpdateValue({
                            tableName: "spare_part_master",
                            xData: xDataList,
                        }),
                    },
                });
            }

            setImportResult({
                success_count: validParts.length,
                skip_count: parsedParts.filter((p) => !p.isValid).length,
                error_count: parsedParts.filter((p) => !p.isValid).length,
                errors: parsedParts
                    .filter((p) => !p.isValid)
                    .map((p) => ({ row: p.rowNumber, reason: p.errors.join(", ") })),
            });
            goTo(5); // Show Results
        } catch (error) {
            console.error("Import error:", error);
            toast.error(MESSAGES.ERROR_IMPORT_FAILED || "Import failed");
        } finally {
            setIsLoading(false);
        }
    };

    const mappingValid = (): boolean => {
        const mapped = new Set(Object.values(columnMapping));
        return mapped.has("part_code") && mapped.has("part_name");
    };

    const mappedPreviewRows = (): { headers: string[]; rows: string[][] } => {
        const headers: string[] = [];
        const colIndices: number[] = [];

        for (const [col, target] of Object.entries(columnMapping)) {
            if (target !== "ignore") {
                headers.push(target.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
                colIndices.push(columns.indexOf(col));
            }
        }

        const rows = previewRows.slice(0, 20).map((row) => colIndices.map((i) => row[i] ?? ""));
        return { headers, rows };
    };

    function renderStep() {
        switch (step) {
            case 1:
                return (
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-[var(--cl-text)]">
                                Brand <span className="text-red-500">*</span>
                            </label>
                            <Select
                                value={brandId?.toString() ?? ""}
                                onValueChange={(v: string) => setBrandId(Number(v))}
                            >
                                <SelectTrigger className="h-8 text-sm">
                                    <SelectValue placeholder="Select brand…" />
                                </SelectTrigger>
                                <SelectContent>
                                    {brands.map((b) => (
                                        <SelectItem key={b.id} value={b.id.toString()}>
                                            {b.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div
                            className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 transition-colors
                                ${
                                    dragOver
                                        ? "border-teal-400 bg-teal-50"
                                        : "border-[var(--cl-border)] bg-[var(--cl-surface-2)] hover:border-teal-300 hover:bg-[var(--cl-surface-3)]"
                                }`}
                            onClick={() => fileInputRef.current?.click()}
                            onDragLeave={() => setDragOver(false)}
                            onDragOver={(e) => {
                                e.preventDefault();
                                setDragOver(true);
                            }}
                            onDrop={handleFileDrop}
                        >
                            <UploadCloudIcon
                                className={`h-10 w-10 ${
                                    dragOver ? "text-teal-500" : "text-[var(--cl-text-muted)]"
                                }`}
                            />
                            <div className="text-center">
                                <p className="text-sm font-medium text-[var(--cl-text)]">
                                    Drop file here or click to browse
                                </p>
                                <p className="mt-0.5 text-xs text-[var(--cl-text-muted)]">
                                    Supported: .csv, .xlsx, .xls
                                </p>
                            </div>
                            {selectedFile && (
                                <div className="flex items-center gap-1.5 rounded-md border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs text-teal-700">
                                    <FileSpreadsheetIcon className="h-3.5 w-3.5" />
                                    {selectedFile.name}
                                </div>
                            )}
                        </div>
                        <input
                            ref={fileInputRef}
                            accept=".csv,.xlsx,.xls"
                            className="hidden"
                            type="file"
                            onChange={handleFileSelect}
                        />
                    </div>
                );

            case 2:
                return (
                    <div className="flex flex-col gap-3">
                        <p className="text-xs text-[var(--cl-text-muted)]">
                            Map each file column to a spare part field.{" "}
                            <span className="font-medium text-[var(--cl-text)]">Part Code</span> and{" "}
                            <span className="font-medium text-[var(--cl-text)]">Part Name</span> are required.
                        </p>
                        <div className="h-64 overflow-y-auto rounded-xl border border-[var(--cl-border)]">
                            <Table>
                                <TableHeader>
                                    <TableRow className="sticky top-0 z-10 bg-[var(--cl-surface-3)] hover:bg-[var(--cl-surface-3)]">
                                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">
                                            File Column
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">
                                            Maps To
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {columns.map((col) => (
                                        <TableRow
                                            key={col}
                                            className="border-b border-[var(--cl-border)] last:border-b-0"
                                        >
                                            <TableCell className="py-2 text-sm font-mono text-[var(--cl-text)]">
                                                {col}
                                            </TableCell>
                                            <TableCell className="py-1.5">
                                                <Select
                                                    value={columnMapping[col] ?? "ignore"}
                                                    onValueChange={(v: string) =>
                                                        setColumnMapping((prev) => ({ ...prev, [col]: v }))
                                                    }
                                                >
                                                    <SelectTrigger className="h-7 text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {TARGET_FIELDS.map((t) => (
                                                            <SelectItem key={t.value} value={t.value}>
                                                                {t.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        {!mappingValid() && (
                            <p className="flex items-center gap-1.5 text-xs text-amber-600">
                                <AlertCircleIcon className="h-3.5 w-3.5" />
                                {MESSAGES.ERROR_IMPORT_MAPPING_MANDATORY || "Part Code and Part Name are mandatory."}
                            </p>
                        )}
                    </div>
                );

            case 3: {
                const { headers, rows } = mappedPreviewRows();
                return (
                    <div className="flex flex-col gap-3">
                        <p className="text-xs text-[var(--cl-text-muted)]">
                            Showing first {rows.length} of {totalRows} rows.
                        </p>
                        <div className="h-64 overflow-y-auto rounded-xl border border-[var(--cl-border)]">
                            <Table>
                                <TableHeader>
                                    <TableRow className="sticky top-0 z-10 bg-[var(--cl-surface-3)] hover:bg-[var(--cl-surface-3)]">
                                        {headers.map((h, i) => (
                                            <TableHead
                                                key={`${h}-${i}`}
                                                className="text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]"
                                            >
                                                {h}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.map((row, i) => (
                                        <TableRow
                                            key={i}
                                            className="border-b border-[var(--cl-border)] last:border-b-0"
                                        >
                                            {row.map((cell, j) => (
                                                <TableCell
                                                    key={j}
                                                    className="max-w-[140px] truncate py-1.5 text-xs text-[var(--cl-text)]"
                                                >
                                                    {cell}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                );
            }

            case 4: {
                if (isLoading) {
                    return (
                        <div className="flex flex-col items-center justify-center gap-4 py-12">
                            <Loader2Icon className="h-10 w-10 animate-spin text-teal-600" />
                            <p className="text-sm font-medium text-[var(--cl-text)]">
                                Validating/Importing data… please wait.
                            </p>
                        </div>
                    );
                }

                const validRows = parsedParts.filter((p) => p.isValid);
                const invalidRows = parsedParts.filter((p) => !p.isValid);

                return (
                    <div className="flex flex-col gap-4">
                        <p className="text-xs text-[var(--cl-text-muted)]">
                            Validation complete. You can proceed to import only the valid rows. Invalid rows will be ignored.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col items-center gap-1 rounded-xl border border-[var(--cl-border)] bg-teal-50 p-4">
                                <span className="text-2xl font-bold text-teal-600">{validRows.length}</span>
                                <span className="text-xs font-medium text-teal-800">Ready to Import</span>
                            </div>
                            <div className="flex flex-col items-center gap-1 rounded-xl border border-[var(--cl-border)] bg-amber-50 p-4">
                                <span className="text-2xl font-bold text-amber-600">{invalidRows.length}</span>
                                <span className="text-xs font-medium text-amber-800">Skipped (Errors/Duplicates)</span>
                            </div>
                        </div>

                        {invalidRows.length > 0 && (
                            <div className="rounded-xl border border-[var(--cl-border)]">
                                <button
                                    className="flex w-full flex-row items-center justify-between px-4 py-2.5 text-sm font-medium text-[var(--cl-text)] hover:bg-[var(--cl-surface-2)]"
                                    onClick={() => setErrorsOpen((o) => !o)}
                                >
                                    <span className="flex items-center gap-1.5">
                                        <AlertCircleIcon className="h-3.5 w-3.5 text-amber-500" />
                                        Show {invalidRows.length} Skipped Rows
                                    </span>
                                    {errorsOpen ? (
                                        <ChevronUpIcon className="h-4 w-4 text-[var(--cl-text-muted)]" />
                                    ) : (
                                        <ChevronDownIcon className="h-4 w-4 text-[var(--cl-text-muted)]" />
                                    )}
                                </button>
                                {errorsOpen && (
                                    <div className="max-h-48 overflow-y-auto border-t border-[var(--cl-border)]">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-[var(--cl-surface-3)] hover:bg-[var(--cl-surface-3)]">
                                                    <TableHead className="text-xs font-semibold uppercase text-[var(--cl-text-muted)]">
                                                        Row
                                                    </TableHead>
                                                    <TableHead className="text-xs font-semibold uppercase text-[var(--cl-text-muted)]">
                                                        Code
                                                    </TableHead>
                                                    <TableHead className="text-xs font-semibold uppercase text-[var(--cl-text-muted)]">
                                                        Reason
                                                    </TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {invalidRows.map((e, i) => (
                                                    <TableRow
                                                        key={i}
                                                        className="border-b border-[var(--cl-border)] last:border-b-0 hidden-scrollbar"
                                                    >
                                                        <TableCell className="w-10 py-1.5 text-xs text-[var(--cl-text-muted)]">
                                                            {e.rowNumber}
                                                        </TableCell>
                                                        <TableCell className="w-20 py-1.5 text-xs font-mono text-[var(--cl-text)]">
                                                            {e.part_code || "--"}
                                                        </TableCell>
                                                        <TableCell className="py-1.5 text-xs text-[var(--cl-text)]">
                                                            {e.errors.join(", ")}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </div>
                        )}
                        {validRows.length > 0 && (
                             <div className="rounded-xl border border-[var(--cl-border)]">
                                <button
                                    className="flex w-full flex-row items-center justify-between px-4 py-2.5 text-sm font-medium text-[var(--cl-text)] hover:bg-[var(--cl-surface-2)]"
                                    onClick={() => setValidRowsOpen((o) => !o)}
                                >
                                    <span className="flex items-center gap-1.5">
                                        <CheckCircle2Icon className="h-3.5 w-3.5 text-teal-600" />
                                        Show {validRows.length} Valid Rows
                                    </span>
                                    {validRowsOpen ? (
                                        <ChevronUpIcon className="h-4 w-4 text-[var(--cl-text-muted)]" />
                                    ) : (
                                        <ChevronDownIcon className="h-4 w-4 text-[var(--cl-text-muted)]" />
                                    )}
                                </button>
                                {validRowsOpen && (
                                    <div className="max-h-48 overflow-y-auto border-t border-[var(--cl-border)]">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-[var(--cl-surface-3)] hover:bg-[var(--cl-surface-3)]">
                                                    <TableHead className="text-xs font-semibold uppercase text-[var(--cl-text-muted)]">Row</TableHead>
                                                    <TableHead className="text-xs font-semibold uppercase text-[var(--cl-text-muted)]">Code</TableHead>
                                                    <TableHead className="text-xs font-semibold uppercase text-[var(--cl-text-muted)]">Name</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {validRows.map((e, i) => (
                                                    <TableRow key={i} className="border-b border-[var(--cl-border)] last:border-b-0 hidden-scrollbar">
                                                        <TableCell className="w-10 py-1.5 text-xs text-[var(--cl-text-muted)]">{e.rowNumber}</TableCell>
                                                        <TableCell className="w-24 py-1.5 text-xs font-mono text-[var(--cl-text)]">{e.part_code}</TableCell>
                                                        <TableCell className="py-1.5 text-xs text-[var(--cl-text)] truncate max-w-[200px]">{e.part_name}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                             </div>
                        )}
                    </div>
                );
            }

            case 5:
                if (!importResult) return null;
                return (
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col items-center justify-center p-6 text-center">
                             <CheckCircle2Icon className="h-16 w-16 text-teal-500 mb-4" />
                             <h3 className="text-lg font-semibold text-[var(--cl-text)] mb-2">Import Successful</h3>
                             <p className="text-sm text-[var(--cl-text-muted)]">
                                 {importResult.success_count} rows were successfully imported.
                                 {importResult.skip_count > 0 && ` ${importResult.skip_count} rows were skipped.`}
                             </p>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    }

    function renderFooter() {
        switch (step) {
            case 1:
                return (
                    <>
                        <Button variant="outline" onClick={handleClose}>
                            Cancel
                        </Button>
                        <Button
                            className="bg-teal-600 text-white hover:bg-teal-700"
                            disabled={!brandId || !selectedFile || isLoading}
                            onClick={processFile}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2Icon className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    Loading…
                                </>
                            ) : (
                                "Next"
                            )}
                        </Button>
                    </>
                );
            case 2:
                return (
                    <>
                        <Button variant="outline" onClick={() => goTo(1)}>
                            Back
                        </Button>
                        <Button
                            className="bg-teal-600 text-white hover:bg-teal-700"
                            disabled={!mappingValid()}
                            onClick={() => goTo(3)}
                        >
                            Next
                        </Button>
                    </>
                );
            case 3:
                return (
                    <>
                        <Button variant="outline" onClick={() => goTo(2)}>
                            Back
                        </Button>
                        <Button
                            className="bg-teal-600 text-white hover:bg-teal-700"
                            disabled={isLoading}
                            onClick={runValidation}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2Icon className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    Checking…
                                </>
                            ) : (
                                "Run Pre-flight Check"
                            )}
                        </Button>
                    </>
                );
            case 4:
                return (
                    <>
                        <Button variant="outline" onClick={() => goTo(3)}>
                            Back
                        </Button>
                        <Button
                            className="bg-teal-600 text-white hover:bg-teal-700"
                            disabled={isLoading || parsedParts.filter((p) => p.isValid).length === 0}
                            onClick={doImport}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2Icon className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    Importing…
                                </>
                            ) : (
                                `Import ${parsedParts.filter((p) => p.isValid).length} Rows`
                            )}
                        </Button>
                    </>
                );
            case 5:
                return (
                    <Button
                        className="bg-teal-600 text-white hover:bg-teal-700"
                        onClick={() => {
                            onSuccess();
                            handleClose();
                        }}
                    >
                        Close
                    </Button>
                );
            default:
                return null;
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (!o) handleClose();
            }}
        >
            <DialogContent aria-describedby={undefined} className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Import Spare Parts</DialogTitle>
                </DialogHeader>

                <StepIndicator currentStep={step} />

                <div className="relative min-h-[220px] overflow-hidden">
                    <AnimatePresence custom={direction} mode="wait">
                        <motion.div
                            key={step}
                            animate="center"
                            custom={direction}
                            exit="exit"
                            initial="enter"
                            transition={{ duration: 0.22, ease: "easeInOut" }}
                            variants={slideVariants}
                        >
                            {renderStep()}
                        </motion.div>
                    </AnimatePresence>
                </div>

                <DialogFooter className="gap-2">{renderFooter()}</DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
