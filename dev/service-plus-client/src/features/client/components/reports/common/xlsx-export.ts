import * as XLSX from "xlsx";

type XlsxSheetType = {
    columns?: { header: string; key: string }[];
    name: string;
    rows: Record<string, number | string>[];
};

export type XlsxExportOptionsType = {
    fileName: string;
    sheets:   XlsxSheetType[];
};

function sanitize(name: string): string {
    return name.replace(/[^a-z0-9 _-]+/gi, "_").slice(0, 31);
}

export function exportReportXlsx(opts: XlsxExportOptionsType): void {
    const wb = XLSX.utils.book_new();
    for (const sheet of opts.sheets) {
        const data: Record<string, number | string>[] = sheet.columns
            ? sheet.rows.map(r => {
                const out: Record<string, number | string> = {};
                for (const c of sheet.columns ?? []) {
                    out[c.header] = r[c.key] ?? "";
                }
                return out;
            })
            : sheet.rows;
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, sanitize(sheet.name));
    }
    const fname = opts.fileName.endsWith(".xlsx") ? opts.fileName : `${opts.fileName}.xlsx`;
    XLSX.writeFile(wb, fname);
}
