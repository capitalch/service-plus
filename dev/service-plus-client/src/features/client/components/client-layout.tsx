import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { ClientTopNav } from "./client-top-nav";
import { ClientActivityBar } from "./client-activity-bar";
import { ClientExplorerPanel } from "./client-explorer-panel";
import { ClientStatusBar } from "./client-status-bar";

export type Section = 'configurations' | 'dashboard' | 'inventory' | 'jobs' | 'masters' | 'reports';

function sectionFromPath(pathname: string): Section {
    if (pathname.startsWith('/client/configurations')) return 'configurations';
    if (pathname.startsWith('/client/inventory'))      return 'inventory';
    if (pathname.startsWith('/client/jobs'))           return 'jobs';
    if (pathname.startsWith('/client/masters'))        return 'masters';
    if (pathname.startsWith('/client/reports'))        return 'reports';
    return 'dashboard';
}

type ClientLayoutProps = { children: ReactNode };

export const ClientLayout = ({ children }: ClientLayoutProps) => {
    const { pathname }    = useLocation();
    const activeSection   = sectionFromPath(pathname);

    return (
        <div className="relative h-full bg-[#131313] text-[#e5e2e1]">
            <ClientTopNav activeSection={activeSection} />
            <ClientActivityBar activeSection={activeSection} />
            <ClientExplorerPanel activeSection={activeSection} />
            <main className="absolute bottom-6 left-80 right-0 top-12 overflow-y-auto p-6">
                {children}
            </main>
            <ClientStatusBar />
        </div>
    );
};
