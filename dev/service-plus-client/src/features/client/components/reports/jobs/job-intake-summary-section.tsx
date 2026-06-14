import { SQL_MAP } from "@/constants/sql-map";

import { RangeMatrixSection } from "../_common/range-matrix-section";

export const JobIntakeSummarySection = () => (
    <RangeMatrixSection
        description="Jobs received across all standard date buckets, split warranty vs out-of-warranty"
        fileSlug="job-intake-summary"
        sqlId={SQL_MAP.GET_JOBS_RECEIVED_RANGE_SPLIT}
        title="Job Intake Summary"
    />
);
