import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Building2, CheckCircle2, XCircle } from "lucide-react";
import { useLocation } from "react-router-dom";

import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
    selectCurrentDivision,
    selectIsGstMode,
    selectSchema,
    setDefaultGstRate,
    setDefaultHsnForSparePart,
    setDefaultHsnForServiceCharge,
} from "@/store/context-slice";
import { ClientActivityBar } from "./client-activity-bar";
import { ClientExplorerPanel } from "./client-explorer-panel";
import { ClientStatusBar } from "./client-status-bar";
import { ClientTopNav } from "./client-top-nav";

export type Section = 'configurations' | 'dashboard' | 'inventory' | 'jobs' | 'masters' | 'reports';

type ThemeContextType = { isDark: boolean; toggleTheme: () => void };

export const ThemeContext = createContext<ThemeContextType>({ isDark: false, toggleTheme: () => {} });

export const useTheme = () => useContext(ThemeContext);

type ClientSelectionContextType = { onSelect: (label: string, group?: string) => void; selected: string; selectedGroup: string };

export const ClientSelectionContext = createContext<ClientSelectionContextType>({
    onSelect: () => {},
    selected: '',
    selectedGroup: '',
});

export const useClientSelection = () => useContext(ClientSelectionContext);

type LayoutContextType = { explorerOpen: boolean; toggleExplorer: () => void };

export const LayoutContext = createContext<LayoutContextType>({ explorerOpen: true, toggleExplorer: () => {} });

export const useLayout = () => useContext(LayoutContext);

function sectionFromPath(pathname: string): Section {
    if (pathname.startsWith('/client/configurations')) return 'configurations';
    if (pathname.startsWith('/client/inventory'))      return 'inventory';
    if (pathname.startsWith('/client/jobs'))           return 'jobs';
    if (pathname.startsWith('/client/masters'))        return 'masters';
    if (pathname.startsWith('/client/reports'))        return 'reports';
    return 'dashboard';
}

const SECTION_LABELS: Record<Section, string> = {
    configurations: 'Configurations',
    dashboard:      'Dashboard',
    inventory:      'Inventory',
    jobs:           'Jobs',
    masters:        'Masters',
    reports:        'Reports',
};

const SECTION_DEFAULTS: Record<Section, string> = {
    configurations: 'Divisions',
    dashboard:      'Overview',
    inventory:      'Stock Overview',
    jobs:           'Single Job',
    masters:        'Branch',
    reports:        'Job Status Report',
};

const SECTION_DEFAULT_GROUPS: Record<Section, string> = {
    configurations: '',
    dashboard:      '',
    inventory:      '',
    jobs:           'New Job',
    masters:        'Organization',
    reports:        'Job Reports',
};

type ClientLayoutProps = { children: ReactNode };

export const ClientLayout = ({ children }: ClientLayoutProps) => {
    const { pathname }                      = useLocation();
    const activeSection                     = sectionFromPath(pathname);
    const dispatch                          = useAppDispatch();
    const dbName                            = useAppSelector(selectDbName);
    const schema                            = useAppSelector(selectSchema);
    const currentDivision                   = useAppSelector(selectCurrentDivision);
    const isGstMode                         = useAppSelector(selectIsGstMode);
    const [selected, setSelected]           = useState(() => SECTION_DEFAULTS[activeSection]);
    const [selectedGroup, setSelectedGroup] = useState(() => SECTION_DEFAULT_GROUPS[activeSection]);
    const [explorerOpen, setExplorerOpen]   = useState(() => window.innerWidth >= 1024);
    const [isDark, setIsDark]               = useState(() => {
        const stored = localStorage.getItem('client-theme');
        return stored ? stored === 'dark' : false;
    });

    useEffect(() => {
        setSelected(SECTION_DEFAULTS[activeSection]);
        setSelectedGroup(SECTION_DEFAULT_GROUPS[activeSection]);
    }, [activeSection]);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', isDark);
        localStorage.setItem('client-theme', isDark ? 'dark' : 'light');
    }, [isDark]);

    // Auto open/close explorer based on screen width
    useEffect(() => {
        const handler = () => {
            if (window.innerWidth >= 1024) setExplorerOpen(true);
            else if (window.innerWidth < 1024) setExplorerOpen(false);
        };
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, []);

    useEffect(() => {
        if (!dbName || !schema) return;

        void apolloClient.query<{ genericQuery: { setting_key: string; setting_value: unknown }[] }>({
            fetchPolicy: 'network-only',
            query:       GRAPHQL_MAP.genericQuery,
            variables:   { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_APP_SETTINGS }) },
        }).then(res => {
            const settings = res.data?.genericQuery ?? [];
            const rawGst = settings.find(s => s.setting_key === 'default_gst_rate')?.setting_value;
            let parsedGst: unknown = rawGst;
            if (typeof rawGst === 'string') { try { parsedGst = JSON.parse(rawGst); } catch { /* keep raw */ } }
            dispatch(setDefaultGstRate(Number(parsedGst ?? 0)));

            const rawHsn = settings.find(s => s.setting_key === 'default_hsn_for_spare_part')?.setting_value;
            let parsedHsn: unknown = rawHsn;
            if (typeof rawHsn === 'string') { try { parsedHsn = JSON.parse(rawHsn); } catch { /* keep raw */ } }
            dispatch(setDefaultHsnForSparePart(String(parsedHsn ?? "")));

            const rawSvcHsn = settings.find(s => s.setting_key === 'default_hsn_for_service_charge')?.setting_value;
            let parsedSvcHsn: unknown = rawSvcHsn;
            if (typeof rawSvcHsn === 'string') { try { parsedSvcHsn = JSON.parse(rawSvcHsn); } catch { /* keep raw */ } }
            dispatch(setDefaultHsnForServiceCharge(String(parsedSvcHsn ?? "")));
        }).catch(() => {/* silently ignore */});
    }, [dbName, schema]); // eslint-disable-line react-hooks/exhaustive-deps

    const toggleTheme    = useCallback(() => setIsDark(d => !d), []);
    const toggleExplorer = useCallback(() => setExplorerOpen(o => !o), []);

    const onSelect = useCallback((label: string, group?: string) => {
        setSelected(label);
        setSelectedGroup(group ?? '');
        // Auto-close explorer on mobile/tablet after selection
        if (window.innerWidth < 1024) setExplorerOpen(false);
    }, []);

    const displayTitle = [SECTION_LABELS[activeSection], selectedGroup, selected]
        .filter(Boolean)
        .join(' > ');

    // Main content left offset:
    //   mobile (<md):  left-0   (no sidebars)
    //   tablet (md-lg): left-16 (activity bar only; explorer is overlay)
    //   desktop (lg+): left-80 when open, left-16 when closed
    const mainLeft = explorerOpen ? 'left-0 md:left-16 lg:left-80' : 'left-0 md:left-16 lg:left-16';

    return (
        <ThemeContext.Provider value={{ isDark, toggleTheme }}>
        <LayoutContext.Provider value={{ explorerOpen, toggleExplorer }}>
        <ClientSelectionContext.Provider value={{ onSelect, selected, selectedGroup }}>
            <div className="client-theme relative h-full bg-(--cl-bg) text-(--cl-text)" data-theme={isDark ? 'dark' : 'light'}>
                <ClientTopNav activeSection={activeSection} />
                <ClientActivityBar activeSection={activeSection} />
                <ClientExplorerPanel activeSection={activeSection} />

                {/* Backdrop — overlay mode on mobile/tablet */}
                {explorerOpen && (
                    <div
                        className="fixed inset-0 z-20 bg-black/50 lg:hidden"
                        onClick={toggleExplorer}
                    />
                )}

                <main className={`absolute bottom-6 right-0 top-9.5 flex flex-col p-4 pt-3 sm:p-6 sm:pt-4 transition-[left] duration-200 ${mainLeft}`}>
                    <div className="mb-3 flex items-center justify-between sm:mb-2 gap-4">
                        <p className="text-xs font-bold text-(--cl-accent-text) tracking-wider">
                            {displayTitle}
                        </p>
                        {currentDivision && (
                            <div className="flex items-center gap-2.5">
                                <div className={`flex items-center gap-1 px-1.5 py-1 rounded-sm border shadow-sm ${
                                    isGstMode ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"
                                }`}>
                                    {isGstMode
                                        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                        : <XCircle      className="h-3.5 w-3.5 text-red-600" />
                                    }
                                    <span className={`text-[10.5px] font-bold uppercase tracking-tighter ${isGstMode ? "text-emerald-700" : "text-red-700"}`}>
                                        {isGstMode ? "GST" : "Non-GST"}
                                    </span>
                                </div>
                                <Building2 className="h-4 w-4 text-(--cl-accent)" />
                                <div className="flex flex-col leading-none">
                                    <span className="text-sm font-bold text-(--cl-text) tracking-tight uppercase">
                                        {currentDivision.name}
                                    </span>
                                    <span className="text-[10px] leading-none text-(--cl-text-muted)">(Default division)</span>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                        {children}
                    </div>
                </main>
                <ClientStatusBar />
            </div>
        </ClientSelectionContext.Provider>
        </LayoutContext.Provider>
        </ThemeContext.Provider>
    );
};
