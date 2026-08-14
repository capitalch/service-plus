import { SQL_MAP } from "@/constants/sql-map";

import type { CategoryBucketFieldType, CategoryRangeRowType, CategorySplitType } from "../common/use-category-range-matrix";
import { CATEGORY_BUCKET_COLUMNS, useCategoryRangeMatrix } from "../common/use-category-range-matrix";
import { useFiscalSetting } from "../common/use-fiscal-setting";

// The three stages a job passes through, in workflow order. Revenue / profit exist only for
// the delivered stage: they are booked from the job invoice at delivery, so the received and
// repaired stages carry no financial figures.
export const JOB_STAGES = [
    { color: "#3b82f6", key: "received",  label: "Jobs Received",      shortLabel: "Received" },
    { color: "#f59e0b", key: "repaired",  label: "Jobs Repaired (OK)", shortLabel: "Repaired" },
    { color: "#10b981", key: "delivered", label: "Jobs Delivered (OK)", shortLabel: "Delivered" },
] as const;

export type JobStageKeyType = typeof JOB_STAGES[number]["key"];

export type StageCellsType = Record<CategoryBucketFieldType, CategorySplitType>;

export type JobsCombinedMatrixType = {
    categories: string[];
    error:      Error | null;
    loading:    boolean;
    refetch:    () => void;
    stages:     Record<JobStageKeyType, CategoryRangeRowType[]>;
};

export const ZERO_SPLIT: CategorySplitType = { oow_count: 0, profit_amount: 0, revenue_amount: 0, warranty_count: 0 };

function addSplit(a: CategorySplitType, b: CategorySplitType): CategorySplitType {
    return {
        oow_count:      a.oow_count + b.oow_count,
        profit_amount:  a.profit_amount + b.profit_amount,
        revenue_amount: a.revenue_amount + b.revenue_amount,
        warranty_count: a.warranty_count + b.warranty_count,
    };
}

function emptyCells(): StageCellsType {
    const cells = {} as StageCellsType;
    CATEGORY_BUCKET_COLUMNS.forEach(b => { cells[b.field] = ZERO_SPLIT; });
    return cells;
}

export function splitTotal(split: CategorySplitType): number {
    return split.warranty_count + split.oow_count;
}

export function stageCells(rows: CategoryRangeRowType[], category: string): StageCellsType {
    const cells = emptyCells();
    const row   = rows.find(r => r.category === category);
    if (row) CATEGORY_BUCKET_COLUMNS.forEach(b => { cells[b.field] = row[b.field]; });
    return cells;
}

export function stageTotals(rows: CategoryRangeRowType[]): StageCellsType {
    const cells = emptyCells();
    CATEGORY_BUCKET_COLUMNS.forEach(b => {
        cells[b.field] = rows.reduce((acc, r) => addSplit(acc, r[b.field]), ZERO_SPLIT);
    });
    return cells;
}

// Each stage keeps its own source query (and its own date column server-side: job_date,
// updated_at, delivery_date), so every figure built from this hook matches the dedicated
// Jobs Received / Repaired (OK) / Delivered (OK) tab exactly.
export const useJobsCombinedMatrix = (): JobsCombinedMatrixType => {
    const { fyStartMonth, isReady } = useFiscalSetting();

    const received  = useCategoryRangeMatrix(SQL_MAP.GET_JOBS_RECEIVED_BY_CATEGORY_RANGE_SPLIT, fyStartMonth, isReady);
    const repaired  = useCategoryRangeMatrix(SQL_MAP.GET_JOBS_REPAIRED_OK_BY_CATEGORY_RANGE_SPLIT, fyStartMonth, isReady);
    const delivered = useCategoryRangeMatrix(SQL_MAP.GET_JOBS_DELIVERED_OK_BY_CATEGORY_RANGE_SPLIT, fyStartMonth, isReady);

    const categories = Array.from(new Set([
        ...received.rows.map(r => r.category),
        ...repaired.rows.map(r => r.category),
        ...delivered.rows.map(r => r.category),
    ])).sort();

    function refetch() {
        received.refetch();
        repaired.refetch();
        delivered.refetch();
    }

    return {
        categories,
        error:   received.error ?? repaired.error ?? delivered.error,
        loading: received.loading || repaired.loading || delivered.loading,
        refetch,
        stages:  {
            delivered: delivered.rows,
            received:  received.rows,
            repaired:  repaired.rows,
        },
    };
};
