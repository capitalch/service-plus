import { SQL_MAP } from "@/constants/sql-map";

import { TechnicianMonthlyReport } from "./technician-monthly-report";

export const TechnicianReport1Section = () => (
	<TechnicianMonthlyReport
		showWarranty={false}
		sqlId={SQL_MAP.GET_TECHNICIAN_REPORTS_MONTHLY_FY}
		subtitle={(fyLabel) =>
			`Jobs delivered OK, profit and sale by technician × month — ${fyLabel}. Click a cell to view that technician's delivered jobs for the month.`
		}
		title="Technician Report 1"
	/>
);
