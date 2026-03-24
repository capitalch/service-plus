import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { ClientActivityBar } from "./client-activity-bar";
import { ClientExplorerPanel } from "./client-explorer-panel";
import { ClientStatusBar } from "./client-status-bar";
import { ClientTopNav } from "./client-top-nav";

export type Section = 'configurations' | 'dashboard' | 'inventory' | 'jobs' | 'masters' | 'reports';

type ClientSelectionContextType = { onSelect: (label: string) => void; selected: string };

export const ClientSelectionContext = createContext<ClientSelectionContextType>({
    onSelect: () => {},
    selected: '',
});

export const useClientSelection = () => useContext(ClientSelectionContext);

function sectionFromPath(pathname: string): Section {
    if (pathname.startsWith('/client/configurations')) return 'configurations';
    if (pathname.startsWith('/client/inventory'))      return 'inventory';
    if (pathname.startsWith('/client/jobs'))           return 'jobs';
    if (pathname.startsWith('/client/masters'))        return 'masters';
    if (pathname.startsWith('/client/reports'))        return 'reports';
    return 'dashboard';
}

const SECTION_DEFAULTS: Record<Section, string> = {
    configurations: 'Company Profile',
    dashboard:      'Overview',
    inventory:      'Stock Overview',
    jobs:           'New Job',
    masters:        'Branch',
    reports:        'Job Status Report',
};

type ClientLayoutProps = { children: ReactNode };

export const ClientLayout = ({ children }: ClientLayoutProps) => {
    const { pathname }              = useLocation();
    const activeSection             = sectionFromPath(pathname);
    const [selected, setSelected]   = useState(() => SECTION_DEFAULTS[activeSection]);

    useEffect(() => { setSelected(SECTION_DEFAULTS[activeSection]); }, [activeSection]);

    const displayTitle = selected;

    return (
        <ClientSelectionContext.Provider value={{ onSelect: setSelected, selected }}>
            <div className="relative h-full bg-[#131313] text-[#e5e2e1]">
                <ClientTopNav activeSection={activeSection} />
                <ClientActivityBar activeSection={activeSection} />
                <ClientExplorerPanel activeSection={activeSection} />
                <main className="absolute bottom-6 left-80 right-0 top-12 overflow-y-auto p-6">
                    <div className="mb-6">
                        <p className="text-sm font-semibold uppercase tracking-widest text-[#e5e2e1]">
                            {displayTitle}
                        </p>
                    </div>
                    {children}
                </main>
                <ClientStatusBar />
            </div>
        </ClientSelectionContext.Provider>
    );
};
