import { useMemo } from "react";

import { SQL_MAP } from "@/constants/sql-map";
import { selectCurrentUser } from "@/features/auth/store/auth-slice";
import { ACCESS_RIGHTS, hasAccessRight } from "@/features/auth/utils/access-rights";
import { selectCurrentBranch, selectExtendedWarrantyEnabled } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

import { useGenericQuery } from "../reports/common/use-generic-query";

export type NotificationsSummary = {
	ewOpenInterest: number;
	jobsOverdue: number;
	lowStockParts: number;
	unpostedDocs: number;
};

// Today's date as YYYY-MM-DD. jobs_overdue ignores the range (SQL filters on
// CURRENT_DATE - INTERVAL '7 days'), so any range works — today is the natural pick.
function todayIso(): string {
	return new Date().toISOString().slice(0, 10);
}

type EwInterestRow = { open_interest: number };
type KpiRow = { jobs_overdue: number };
type UnpostedRow = { job_invoices: number; money_receipts: number; purchase_invoices: number; sales_invoices: number };
type LowStockRow = { total: number };

const num = (v: unknown) => Number(v ?? 0);

// Aggregates cheap signals the app already computes into a single summary for the
// notification bell. Pure composition of existing generic queries — no new backend.
export function useNotificationsSummary(): NotificationsSummary {
	const branch = useAppSelector(selectCurrentBranch);
	const branchId = branch?.id;
	const extendedWarrantyEnabled = useAppSelector(selectExtendedWarrantyEnabled);
	const user = useAppSelector(selectCurrentUser);

	const today = useMemo(() => todayIso(), []);
	const dateArgs = useMemo(() => ({ from: today, to: today }), [today]);

	const kpisQ = useGenericQuery<KpiRow>({
		sqlArgs: dateArgs,
		sqlId: SQL_MAP.GET_DASHBOARD_KPIS,
	});

	const unpostedQ = useGenericQuery<UnpostedRow>({
		enabled: !!branchId,
		sqlArgs: { branch_id: branchId },
		sqlId: SQL_MAP.GET_UNPOSTED_COUNTS_BY_DIVISION,
	});

	// Reuse Part Finder's paged query (COUNT(*) OVER() → `total`) as a low-stock
	// counter. Full arg set mirrors part-finder-page so the SQL binds all params.
	const lowStockQ = useGenericQuery<LowStockRow>({
		enabled: !!branchId,
		sqlArgs: {
			brand: "",
			branch_id: branchId,
			limit: 1,
			location: "",
			offset: 0,
			search: "",
			stock_status: "low_stock",
		},
		sqlId: SQL_MAP.PART_FINDER_PAGED,
	});

	// Extended Warranty leads waiting in Interested — queried only when the add-on is on
	// and this user may open it, so the bell never points at a screen they cannot reach.
	const ewQ = useGenericQuery<EwInterestRow>({
		enabled: !!branchId && extendedWarrantyEnabled && hasAccessRight(user, ACCESS_RIGHTS.CUSTOM_EXTENDED_WARRANTY),
		sqlArgs: { branch_id: branchId },
		sqlId: SQL_MAP.COUNT_EW_OPEN_INTEREST,
	});

	const ewOpenInterest = num(ewQ.data?.[0]?.open_interest);
	const jobsOverdue = num(kpisQ.data?.[0]?.jobs_overdue);
	const unpostedDocs = unpostedQ.data.reduce(
		(sum, d) =>
			sum + num(d.money_receipts) + num(d.purchase_invoices) + num(d.sales_invoices) + num(d.job_invoices),
		0,
	);
	const lowStockParts = num(lowStockQ.data?.[0]?.total);

	return { ewOpenInterest, jobsOverdue, lowStockParts, unpostedDocs };
}
