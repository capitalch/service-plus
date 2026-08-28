import { useMemo, useState } from "react";
import {
    Activity, AlertTriangle, ClipboardList, IndianRupee,
    Package, ShieldCheck, Timer, Wrench,
} from "lucide-react";

import { SQL_MAP } from "@/constants/sql-map";

import { ChartCard } from "../common/chart-card";
import { formatInr, formatNumber } from "../common/formatters";
import { KpiCard } from "../common/kpi-card";
import { KpiGrid } from "../common/kpi-grid";
import { ReportEmpty } from "../common/report-empty";
import { ReportError } from "../common/report-error";
import { ReportLoading } from "../common/report-loading";
import { ReportSection } from "../common/report-section";
import { ReportToolbar } from "../common/report-toolbar";
import { formatIsoDate, getRange, startOfDay } from "../common/fiscal";
import type { RangeKeyType } from "../common/fiscal";
import { useFiscalSetting } from "../common/use-fiscal-setting";
import { useGenericQuery } from "../common/use-generic-query";
import { DashboardMonthlyChart } from "./dashboard-monthly-chart";
import { DashboardRecentJobs } from "./dashboard-recent-jobs";
import { DashboardAlertsPanel } from "./dashboard-alerts-panel";
import { DashboardJobsListDialog } from "./dashboard-jobs-list-dialog";
import { DashboardOverdueDetailDialog } from "./dashboard-overdue-detail-dialog";
import { DashboardRevenueDetailDialog } from "./dashboard-revenue-detail-dialog";
import { OpenJobsByProductDialog } from "./open-jobs-by-product-dialog";

type JobsListModalType = {
    description?: string;
    sqlArgs: Record<string, unknown>;
    sqlId: string;
    title: string;
};

type RangeOptionType = { key: RangeKeyType; label: string };

const RANGE_OPTIONS: RangeOptionType[] = [
    { key: "today",              label: "Today" },
    { key: "yesterday",          label: "Yesterday" },
    { key: "dayBeforeYesterday", label: "Day Before" },
    { key: "thisWeek",           label: "This Week" },
    { key: "prevWeek",           label: "Previous Week" },
    { key: "thisMonth",          label: "This Month" },
    { key: "lastMonth",          label: "Previous Month" },
];

type DashboardKpiRowType = {
    jobs_delivered: number;
    jobs_open: number;
    jobs_open_oow: number;
    jobs_open_warranty: number;
    jobs_overdue: number;
    jobs_received: number;
    jobs_received_oow: number;
    jobs_received_warranty: number;
    revenue: number;
};

const OVERDUE_DAYS = 7;
const RECENT_LIMIT = 8;

export const DashboardSection = () => {
    const { fyStartMonth, isReady } = useFiscalSetting();
    const [rangeIndex, setRangeIndex] = useState(0);
    const [openJobsByProductOpen, setOpenJobsByProductOpen] = useState(false);
    const [revenueDetailOpen, setRevenueDetailOpen] = useState(false);
    const [overdueDetailOpen, setOverdueDetailOpen] = useState(false);
    const [jobsListModal, setJobsListModal] = useState<JobsListModalType | null>(null);
    const selectedRange = RANGE_OPTIONS[rangeIndex];

    const todayRange  = useMemo(() => getRange(selectedRange.key, new Date(), fyStartMonth), [selectedRange.key, fyStartMonth]);
    const yearRange   = useMemo(() => {
        const today = new Date();
        const start = startOfDay(new Date(today.getFullYear() - 1, today.getMonth(), 1));
        return { from: start, to: today };
    }, []);

    const todayArgs = useMemo(() => ({
        from: formatIsoDate(todayRange.from),
        to:   formatIsoDate(todayRange.to),
    }), [todayRange]);

    const monthlyArgs = useMemo(() => ({
        from: formatIsoDate(yearRange.from),
        to:   formatIsoDate(yearRange.to),
    }), [yearRange]);

    const kpisQ = useGenericQuery<DashboardKpiRowType>({
        enabled: isReady,
        sqlArgs: todayArgs,
        sqlId:   SQL_MAP.GET_DASHBOARD_KPIS,
    });

    const monthlyQ = useGenericQuery<{ month: string; oow_count: number; total_count: number; warranty_count: number }>({
        enabled: isReady,
        sqlArgs: monthlyArgs,
        sqlId:   SQL_MAP.GET_DASHBOARD_MONTHLY_INTAKE,
    });

    const recentQ = useGenericQuery<{
        brand_name: string | null;
        customer_name: string;
        id: number;
        is_warranty: boolean;
        job_date: string;
        job_no: string;
        model_name: string | null;
        product_name: string | null;
        status_code: string;
        status_name: string;
        technician_name: string | null;
    }>({
        enabled: isReady,
        sqlArgs: { limit: RECENT_LIMIT },
        sqlId:   SQL_MAP.GET_DASHBOARD_RECENT_JOBS,
    });

    const overdueQ = useGenericQuery<{
        customer_name: string;
        days_old: number;
        id: number;
        job_date: string;
        job_no: string;
        status_name: string;
        technician_name: string | null;
    }>({
        enabled: isReady,
        sqlArgs: { limit: 5, overdue_days: OVERDUE_DAYS },
        sqlId:   SQL_MAP.GET_DASHBOARD_OVERDUE_JOBS,
    });

    const kpis = kpisQ.data?.[0];

    function handleRefresh() {
        kpisQ.refetch();
        monthlyQ.refetch();
        recentQ.refetch();
        overdueQ.refetch();
    }

    if (!isReady || kpisQ.loading) {
        return (
            <ReportSection>
                <ReportToolbar title="Operations Dashboard" subtitle="Today at a glance" />
                <ReportLoading />
            </ReportSection>
        );
    }

    if (kpisQ.error) {
        return (
            <ReportSection>
                <ReportToolbar title="Operations Dashboard" subtitle="Today at a glance" onRefresh={handleRefresh} />
                <ReportError onRetry={handleRefresh} />
            </ReportSection>
        );
    }

    const rangePicker = (
        <div className="flex flex-wrap gap-0.5 rounded-md border border-(--cl-border) bg-(--cl-surface-3) p-0.5">
            {RANGE_OPTIONS.map((opt, idx) => (
                <button
                    key={opt.key}
                    className={`cursor-pointer rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                        rangeIndex === idx
                            ? "bg-white dark:bg-zinc-800 text-(--cl-text) shadow-sm"
                            : "text-(--cl-text-muted) hover:text-(--cl-text)"
                    }`}
                    type="button"
                    onClick={() => setRangeIndex(idx)}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );

    const rangeSubtitle = todayArgs.from === todayArgs.to
        ? `${selectedRange.label}: ${todayArgs.from}`
        : `${selectedRange.label}: ${todayArgs.from} – ${todayArgs.to}`;

    const rangeDescription = todayArgs.from === todayArgs.to
        ? todayArgs.from
        : `${todayArgs.from} – ${todayArgs.to}`;

    return (
        <ReportSection>
            <ReportToolbar
                actions={rangePicker}
                onRefresh={handleRefresh}
                subtitle={rangeSubtitle}
                title="Operations Dashboard"
            />

            <KpiGrid columns={4}>
                <KpiCard
                    accentClassName="text-(--cl-accent-text)"
                    icon={ClipboardList}
                    label={`Jobs Received (${selectedRange.label})`}
                    subValue={kpis ? `W ${formatNumber(kpis.jobs_received_warranty)} / OOW ${formatNumber(kpis.jobs_received_oow)}` : undefined}
                    value={formatNumber(kpis?.jobs_received ?? 0)}
                    onClick={() => setJobsListModal({
                        description: `Jobs received ${rangeDescription}.`,
                        sqlArgs:     { ...todayArgs, is_warranty: null },
                        sqlId:       SQL_MAP.GET_DASHBOARD_JOBS_RECEIVED_LIST,
                        title:       `Jobs Received (${selectedRange.label})`,
                    })}
                />
                <KpiCard
                    accentClassName="text-emerald-500"
                    icon={Wrench}
                    label={`Jobs Delivered (${selectedRange.label})`}
                    value={formatNumber(kpis?.jobs_delivered ?? 0)}
                    onClick={() => setJobsListModal({
                        description: `Jobs delivered ${rangeDescription}.`,
                        sqlArgs:     todayArgs,
                        sqlId:       SQL_MAP.GET_DASHBOARD_JOBS_DELIVERED_LIST,
                        title:       `Jobs Delivered (${selectedRange.label})`,
                    })}
                />
                <KpiCard
                    accentClassName="text-emerald-500"
                    icon={IndianRupee}
                    label={`Revenue (${selectedRange.label})`}
                    value={formatInr(kpis?.revenue ?? 0)}
                    onClick={() => setRevenueDetailOpen(true)}
                />
                <KpiCard
                    accentClassName="text-(--cl-accent-text)"
                    icon={Activity}
                    label="Open Jobs"
                    subValue={kpis ? `W ${formatNumber(kpis.jobs_open_warranty)} / OOW ${formatNumber(kpis.jobs_open_oow)}` : undefined}
                    value={formatNumber(kpis?.jobs_open ?? 0)}
                    onClick={() => setOpenJobsByProductOpen(true)}
                />
            </KpiGrid>

            <KpiGrid columns={4}>
                <KpiCard
                    accentClassName="text-amber-500"
                    icon={Timer}
                    label="Overdue Jobs"
                    subValue={`> ${OVERDUE_DAYS} days`}
                    value={formatNumber(kpis?.jobs_overdue ?? 0)}
                    onClick={() => setOverdueDetailOpen(true)}
                />
                <KpiCard
                    accentClassName="text-orange-500"
                    icon={ShieldCheck}
                    label={`Warranty Jobs (${selectedRange.label})`}
                    value={formatNumber(kpis?.jobs_received_warranty ?? 0)}
                    onClick={() => setJobsListModal({
                        description: `Warranty jobs received ${rangeDescription}.`,
                        sqlArgs:     { ...todayArgs, is_warranty: true },
                        sqlId:       SQL_MAP.GET_DASHBOARD_JOBS_RECEIVED_LIST,
                        title:       `Warranty Jobs (${selectedRange.label})`,
                    })}
                />
                <KpiCard
                    accentClassName="text-emerald-500"
                    icon={Package}
                    label={`Out-of-Warranty (${selectedRange.label})`}
                    value={formatNumber(kpis?.jobs_received_oow ?? 0)}
                    onClick={() => setJobsListModal({
                        description: `Out-of-warranty jobs received ${rangeDescription}.`,
                        sqlArgs:     { ...todayArgs, is_warranty: false },
                        sqlId:       SQL_MAP.GET_DASHBOARD_JOBS_RECEIVED_LIST,
                        title:       `Out-of-Warranty Jobs (${selectedRange.label})`,
                    })}
                />
                <KpiCard
                    accentClassName="text-amber-500"
                    icon={AlertTriangle}
                    label="Alerts"
                    value={formatNumber(overdueQ.data.length)}
                    subValue="Overdue queue"
                    onClick={() => setOverdueDetailOpen(true)}
                />
            </KpiGrid>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <ChartCard
                    className="lg:col-span-2"
                    description="Warranty vs Out-of-Warranty — last 12 months"
                    title="Monthly Jobs Received"
                >
                    {monthlyQ.loading
                        ? <ReportLoading lines={3} />
                        : monthlyQ.data.length === 0
                            ? <ReportEmpty />
                            : <DashboardMonthlyChart data={monthlyQ.data} />
                    }
                </ChartCard>
                <ChartCard description="Open jobs needing follow-up" title="Alerts">
                    {overdueQ.loading
                        ? <ReportLoading lines={3} />
                        : <DashboardAlertsPanel overdue={overdueQ.data} />
                    }
                </ChartCard>
            </div>

            <ChartCard description="Latest jobs across all branches" title="Recent Repair Queue">
                {recentQ.loading
                    ? <ReportLoading lines={4} />
                    : <DashboardRecentJobs jobs={recentQ.data} />
                }
            </ChartCard>

            <OpenJobsByProductDialog
                open={openJobsByProductOpen}
                onClose={() => setOpenJobsByProductOpen(false)}
            />
            <DashboardRevenueDetailDialog
                open={revenueDetailOpen}
                sqlArgs={todayArgs}
                onClose={() => setRevenueDetailOpen(false)}
            />
            <DashboardOverdueDetailDialog
                open={overdueDetailOpen}
                overdueDays={OVERDUE_DAYS}
                onClose={() => setOverdueDetailOpen(false)}
            />
            <DashboardJobsListDialog
                description={jobsListModal?.description}
                open={jobsListModal != null}
                sqlArgs={jobsListModal?.sqlArgs}
                sqlId={jobsListModal?.sqlId ?? ""}
                title={jobsListModal?.title ?? ""}
                onClose={() => setJobsListModal(null)}
            />
        </ReportSection>
    );
};
