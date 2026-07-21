import { useMemo } from "react";
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
import { useFiscalSetting } from "../common/use-fiscal-setting";
import { useGenericQuery } from "../common/use-generic-query";
import { DashboardMonthlyChart } from "./dashboard-monthly-chart";
import { DashboardRecentJobs } from "./dashboard-recent-jobs";
import { DashboardAlertsPanel } from "./dashboard-alerts-panel";

type DashboardKpiRowType = {
    jobs_delivered: number;
    jobs_open: number;
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

    const todayRange  = useMemo(() => getRange("today", new Date(), fyStartMonth), [fyStartMonth]);
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

    return (
        <ReportSection>
            <ReportToolbar
                onRefresh={handleRefresh}
                subtitle={`Today: ${todayArgs.from}`}
                title="Operations Dashboard"
            />

            <KpiGrid columns={4}>
                <KpiCard
                    accentClassName="text-(--cl-accent-text)"
                    icon={ClipboardList}
                    label="Jobs Received Today"
                    subValue={kpis ? `W ${formatNumber(kpis.jobs_received_warranty)} / OOW ${formatNumber(kpis.jobs_received_oow)}` : undefined}
                    value={formatNumber(kpis?.jobs_received ?? 0)}
                />
                <KpiCard
                    accentClassName="text-emerald-500"
                    icon={Wrench}
                    label="Jobs Delivered Today"
                    value={formatNumber(kpis?.jobs_delivered ?? 0)}
                />
                <KpiCard
                    accentClassName="text-emerald-500"
                    icon={IndianRupee}
                    label="Revenue Today"
                    value={formatInr(kpis?.revenue ?? 0)}
                />
                <KpiCard
                    accentClassName="text-(--cl-accent-text)"
                    icon={Activity}
                    label="Open Jobs"
                    value={formatNumber(kpis?.jobs_open ?? 0)}
                />
            </KpiGrid>

            <KpiGrid columns={4}>
                <KpiCard
                    accentClassName="text-amber-500"
                    icon={Timer}
                    label="Overdue Jobs"
                    subValue={`> ${OVERDUE_DAYS} days`}
                    value={formatNumber(kpis?.jobs_overdue ?? 0)}
                />
                <KpiCard
                    accentClassName="text-(--cl-accent-text)"
                    icon={ShieldCheck}
                    label="Warranty Jobs (Today)"
                    value={formatNumber(kpis?.jobs_received_warranty ?? 0)}
                />
                <KpiCard
                    accentClassName="text-(--cl-accent-text)"
                    icon={Package}
                    label="Out-of-Warranty (Today)"
                    value={formatNumber(kpis?.jobs_received_oow ?? 0)}
                />
                <KpiCard
                    accentClassName="text-amber-500"
                    icon={AlertTriangle}
                    label="Alerts"
                    value={formatNumber(overdueQ.data.length)}
                    subValue="Overdue queue"
                />
            </KpiGrid>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <ChartCard
                    className="lg:col-span-2"
                    description="Warranty vs Out-of-Warranty intake — last 12 months"
                    title="Monthly Job Intake"
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
        </ReportSection>
    );
};
