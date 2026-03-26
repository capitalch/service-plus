import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { ClientActivityBar } from "./client-activity-bar";
import { ClientExplorerPanel } from "./client-explorer-panel";
import { ClientStatusBar } from "./client-status-bar";
import { ClientTopNav } from "./client-top-nav";

export type Section = 'configurations' | 'dashboard' | 'inventory' | 'jobs' | 'masters' | 'reports';

type ThemeContextType = { isDark: boolean; toggleTheme: () => void };

export const ThemeContext = createContext<ThemeContextType>({ isDark: true, toggleTheme: () => {} });

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
    configurations: 'Company Profile',
    dashboard:      'Overview',
    inventory:      'Stock Overview',
    jobs:           'New Job',
    masters:        'Branch',
    reports:        'Job Status Report',
};

const SECTION_DEFAULT_GROUPS: Record<Section, string> = {
    configurations: '',
    dashboard:      '',
    inventory:      '',
    jobs:           '',
    masters:        'Organization',
    reports:        'Job Reports',
};

type ClientLayoutProps = { children: ReactNode };

export const ClientLayout = ({ children }: ClientLayoutProps) => {
    const { pathname }                      = useLocation();
    const activeSection                     = sectionFromPath(pathname);
    const [selected, setSelected]           = useState(() => SECTION_DEFAULTS[activeSection]);
    const [selectedGroup, setSelectedGroup] = useState(() => SECTION_DEFAULT_GROUPS[activeSection]);
    const [explorerOpen, setExplorerOpen]   = useState(() => window.innerWidth >= 1024);
    const [isDark, setIsDark]               = useState(() => {
        const stored = localStorage.getItem('client-theme');
        return stored ? stored === 'dark' : true;
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
            else if (window.innerWidth < 768) setExplorerOpen(false);
        };
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, []);

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
            <div className="client-theme relative h-full bg-[var(--cl-bg)] text-[var(--cl-text)]" data-theme={isDark ? 'dark' : 'light'}>
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

                <main className={`absolute bottom-6 right-0 top-12 overflow-y-auto p-4 sm:p-6 transition-[left] duration-200 ${mainLeft}`}>
                    <div className="mb-4 sm:mb-6">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#9fcaff]">
                            {displayTitle}
                        </p>
                    </div>
                    {children}
                </main>
                <ClientStatusBar />
            </div>
        </ClientSelectionContext.Provider>
        </LayoutContext.Provider>
        </ThemeContext.Provider>
    );
};
