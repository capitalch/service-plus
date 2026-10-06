import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";

import { TechnicianMonthlyReport } from "./technician-monthly-report";

/** Report 1's technician × month grid, counting every delivered job and splitting each cell into
 *  out-of-warranty and warranty quantities — see GET_TECHNICIAN_REPORTS_MONTHLY_FY_WARRANTY. */
export const TechnicianReport2Section = () => (
	<TechnicianMonthlyReport
		showWarranty
		sqlId={SQL_MAP.GET_TECHNICIAN_REPORTS_MONTHLY_FY_WARRANTY}
		subtitle={(fyLabel) => `${MESSAGES.INFO_TECH_REPORT2_SUBTITLE} — ${fyLabel}.`}
		title="Technician Report 2"
	/>
);
