export type MappedField = {
    fileColumn: string;
    targetField: string;
};

export type ParsedPart = {
    rowNumber: number;
    rawData: Record<string, string>;
    part_code: string;
    part_name: string;
    brand_id?: number | null;
    category?: string;
    cost_price?: number;
    part_description?: string;
    gst_rate?: number;
    hsn_code?: string;
    model?: string;
    mrp?: number;
    uom?: string;
    isValid: boolean;
    errors: string[];
};

export type ImportPartsResult = {
    success_count: number;
    skip_count: number;
    error_count: number;
    errors: { row: number; reason: string }[];
};
