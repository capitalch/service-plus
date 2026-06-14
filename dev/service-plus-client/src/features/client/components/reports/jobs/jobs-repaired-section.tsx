import { SQL_MAP } from "@/constants/sql-map";

import { RangeMatrixSection } from "../_common/range-matrix-section";

export const JobsRepairedSection = () => (
    <RangeMatrixSection
        description="Jobs marked Completed OK or Delivered OK in each date bucket"
        fileSlug="jobs-repaired-ok"
        sqlId={SQL_MAP.GET_JOBS_REPAIRED_OK_RANGE_SPLIT}
        title="Jobs Repaired (OK)"
    />
);
