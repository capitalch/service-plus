import { SQL_MAP } from "@/constants/sql-map";

import { RangeMatrixSection } from "../_common/range-matrix-section";

export const JobsDeliveredSection = () => (
    <RangeMatrixSection
        description="Jobs Delivered OK in each date bucket"
        fileSlug="jobs-delivered-ok"
        sqlId={SQL_MAP.GET_JOBS_DELIVERED_OK_RANGE_SPLIT}
        title="Jobs Delivered (OK)"
    />
);
