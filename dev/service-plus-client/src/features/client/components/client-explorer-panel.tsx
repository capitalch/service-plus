import { createContext, useContext, useEffect, useState } from "react";
import type { ComponentType } from "react";
import {
    Activity, BarChart3, BookCheck, BookOpen, Building2, Camera, ChevronDown, ChevronRight,
    ClipboardList, DollarSign, FileText, Globe, Hash,
    LayoutDashboard, LineChart, MapPin, Package, PieChart, PlusCircle, Receipt,
    RefreshCcw, RotateCcw, Settings2, ShieldCheck, ShoppingCart,
    Tag, Timer, TrendingUp, Truck, User, UserCog, Users, Wrench,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import { useClientSelection, useLayout } from "./client-layout";
import type { Section } from "./client-layout";
import { selectCurrentUser } from "@/features/auth/store/auth-slice";
import { ROUTES } from "@/router/routes";
import { useAppSelector } from "@/store/hooks";
import { selectPostDataToAccounts } from "@/store/context-slice";

type Props = { activeSection: Section };

const GroupContext = createContext<string>('');

type TreeItemProps = {
    icon: ComponentType<{ className?: string }>;
    iconColor?: string;
    label: string;
};

function TreeItem({ icon: Icon, iconColor, label }: TreeItemProps) {
    const { onSelect, selected } = useClientSelection();
    const group = useContext(GroupContext);
    const isActive = selected === label;

    return (
        <div
            onClick={() => onSelect(label, group || undefined)}
            className={`group flex cursor-pointer items-center gap-2 rounded px-2 py-2 transition-colors duration-150 ${
                isActive
                    ? 'bg-(--cl-accent) text-white shadow-md'
                    : 'text-(--cl-text-muted) hover:bg-(--cl-hover) hover:text-(--cl-text)'
            }`}
        >
            <Icon className={`h-4 w-4 shrink-0 ${iconColor ?? (isActive ? 'text-white' : '')}`} />
            <span className={`truncate text-sm ${isActive ? 'font-bold' : ''}`}>{label}</span>
        </div>
    );
}


type CollapsibleGroupProps = {
    children: React.ReactNode;
    defaultOpen?: boolean;
    label: string;
};

function CollapsibleGroup({ children, defaultOpen = true, label }: CollapsibleGroupProps) {
    const { selectedGroup } = useClientSelection();
    const [open, setOpen] = useState(() => defaultOpen || selectedGroup === label);

    useEffect(() => {
        if (selectedGroup === label) setOpen(true);
    }, [selectedGroup, label]);
    return (
        <section>
            <button
                className="mb-1 flex w-full cursor-pointer items-center gap-1.5 rounded border-l-2 border-(--cl-accent) px-2 py-1.5 text-left transition-colors hover:bg-(--cl-hover)"
                onClick={() => setOpen(o => !o)}
            >
                {open
                    ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-(--cl-accent-text)" />
                    : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-(--cl-accent-text)" />}
                <p className="text-xs font-bold uppercase tracking-wide text-(--cl-accent-text)">{label}</p>
            </button>
            {open && (
                <GroupContext.Provider value={label}>
                    <div className="ml-3 space-y-1">{children}</div>
                </GroupContext.Provider>
            )}
        </section>
    );
}

function ConfigurationsExplorer() {
    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <TreeItem icon={Building2}    label="Divisions" />
                <TreeItem icon={Settings2}    label="App Settings" />
                <TreeItem icon={Hash}         label="Numbering / Auto Series" />
            </div>
        </div>
    );
}

function InventoryExplorer() {
    const currentUser = useAppSelector(selectCurrentUser);
    const isAdmin = currentUser?.userType === "A" || currentUser?.userType === "S";

    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <TreeItem icon={Package}       label="Stock Overview" />
                <TreeItem icon={ShoppingCart}  label="Purchase Entry" />
                <TreeItem icon={Tag}           label="Sales Entry" />
                <TreeItem icon={RefreshCcw}    label="Stock Adjustment" />
                <TreeItem icon={Truck}         label="Branch Transfer" />
                <TreeItem icon={ClipboardList} label="Loan Entry" />
                <TreeItem icon={Package}       label="Opening Stock" />
                <TreeItem icon={Globe}         label="Part Finder" />
                <TreeItem icon={MapPin}        label="Set Part Location" />
            </div>
            {isAdmin && (
                <CollapsibleGroup defaultOpen={false} label="Admin">
                    <TreeItem icon={Camera} label="Stock Snapshot" />
                </CollapsibleGroup>
            )}
        </div>
    );
}

function JobsExplorer() {
    const postDataToAccounts = useAppSelector(selectPostDataToAccounts);

    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <CollapsibleGroup label="New Job">
                    <TreeItem icon={PlusCircle} label="Single Job" />
                    <TreeItem icon={PlusCircle} label="Batch Jobs" />
                </CollapsibleGroup>
                <TreeItem icon={ClipboardList} label="Job Search" />
                <TreeItem icon={BarChart3}     label="Job Pipeline" />
                <TreeItem icon={FileText}      label="Final a Job" />
                <TreeItem icon={Truck}         label="Deliver Job" />
                {postDataToAccounts && <TreeItem icon={BookCheck} label="Accounts Posting" />}
                <TreeItem icon={RotateCcw}     label="Opening Jobs" />
                <TreeItem icon={Receipt}       label="Receipts" />
                <TreeItem icon={Package}       label="Part Used (Job)" />
            </div>
        </div>
    );
}


function MastersExplorer() {
    return (
        <div className="space-y-3">
            <CollapsibleGroup label="Organization">
                <TreeItem icon={Building2} label="Branch" />
                <TreeItem icon={Hash}      label="Financial Year" />
                <TreeItem icon={MapPin}    label="State / Province" />
            </CollapsibleGroup>
            <CollapsibleGroup label="Entities">
                <TreeItem icon={User}    label="Customer" />
                <TreeItem icon={Truck}   label="Vendor / Supplier" />
                <TreeItem icon={UserCog} label="Technician" />
            </CollapsibleGroup>
            <CollapsibleGroup label="Service Config" defaultOpen={false}>
                <TreeItem icon={Users}         label="Customer Type" />
                <TreeItem icon={FileText}      label="Document Type" />
                <TreeItem icon={Wrench}        label="Job Type" />
                <TreeItem icon={ClipboardList} label="Job Status" />
                <TreeItem icon={RotateCcw}     label="Job Receive Manner" />
                <TreeItem icon={Truck}         label="Job Delivery Manner" />
                <TreeItem icon={Settings2}     label="Job Receive Condition" />
                <TreeItem icon={Receipt}       label="Job Additional Charges" />
            </CollapsibleGroup>
            <CollapsibleGroup label="Product & Parts" defaultOpen={false}>
                <TreeItem icon={Tag}      label="Brand" />
                <TreeItem icon={Package}  label="Product" />
                <TreeItem icon={BookOpen} label="Model" />
                <TreeItem icon={Package}  label="Parts" />
                <TreeItem icon={MapPin}   label="Part Location" />
            </CollapsibleGroup>
        </div>
    );
}

function ReportsExplorer() {
    return (
        <div className="space-y-3">
            <div className="space-y-1">
                <TreeItem icon={LayoutDashboard} label="Dashboard" />
            </div>
            <CollapsibleGroup label="Job Reports">
                <TreeItem icon={ClipboardList} label="Job Intake Summary" />
                <TreeItem icon={Wrench}        label="Jobs Repaired (OK)" />
                <TreeItem icon={Truck}         label="Jobs Delivered (OK)" />
                <TreeItem icon={FileText}      label="Delivered Jobs — Detailed" />
                <TreeItem icon={Activity}      label="Job Transaction Ledger" />
                <TreeItem icon={Timer}         label="Job Pipeline / Aging" />
                <TreeItem icon={LineChart}     label="Job Status Trend" />
            </CollapsibleGroup>
            <CollapsibleGroup label="Warranty Reports">
                <TreeItem icon={ShieldCheck} iconColor="text-emerald-500" label="Warranty Repairs & Parts Value" />
                <TreeItem icon={FileText}    iconColor="text-emerald-500" label="Warranty Parts Consumption Detail" />
                <TreeItem icon={LineChart}   iconColor="text-emerald-500" label="Warranty Trend (6-month)" />
            </CollapsibleGroup>
            <CollapsibleGroup label="Financial Reports" defaultOpen={false}>
                <TreeItem icon={DollarSign} label="Profit Summary" />
                <TreeItem icon={DollarSign} label="Revenue Report" />
                <TreeItem icon={FileText}   label="Cash Register" />
                <TreeItem icon={BarChart3}  label="Sales Report" />
                <TreeItem icon={Receipt}    label="GST Summary" />
            </CollapsibleGroup>
            <CollapsibleGroup label="Performance Reports" defaultOpen={false}>
                <TreeItem icon={TrendingUp} label="Technician Scorecard" />
                <TreeItem icon={BarChart3}  label="Technician Repaired vs Delivered" />
                <TreeItem icon={BarChart3}  label="Technician Profit & Revenue" />
                <TreeItem icon={Activity}   label="Technician Productivity Heatmap" />
            </CollapsibleGroup>
            <CollapsibleGroup label="Inventory Reports" defaultOpen={false}>
                <TreeItem icon={Package}       label="Spare Parts Ledger (Op/Dr/Cr/Cl)" />
                <TreeItem icon={Timer}         label="Spare Parts Aging" />
                <TreeItem icon={Timer}         label="Slow Movers (Aged > 1 year)" />
                <TreeItem icon={ClipboardList} label="Parts Consumption — Detailed" />
                <TreeItem icon={FileText}      label="Stock Ledger" />
                <TreeItem icon={RotateCcw}     label="Stock Movement Summary" />
                <TreeItem icon={ShoppingCart}  label="Parts Reorder Suggestions" />
            </CollapsibleGroup>
            <CollapsibleGroup label="Trends" defaultOpen={false}>
                <TreeItem icon={BarChart3} label="Jobs Received — Monthly" />
                <TreeItem icon={BarChart3} label="Jobs Received — Year-wise" />
                <TreeItem icon={LineChart} label="Jobs Received — 12/24/36-month" />
                <TreeItem icon={PieChart}  label="Repair vs Deliver Funnel" />
                <TreeItem icon={TrendingUp} label="Profit Trend (YoY)" />
            </CollapsibleGroup>
        </div>
    );
}

const EXPLORERS: Record<Section, ComponentType> = {
    configurations: ConfigurationsExplorer,
    inventory:      InventoryExplorer,
    jobs:           JobsExplorer,
    masters:        MastersExplorer,
    reports:        ReportsExplorer,
};

const SECTION_TITLES: Record<Section, string> = {
    configurations: 'System Configuration',
    inventory:      'Stock & Parts',
    jobs:           'Job Lifecycle',
    masters:        'Master Data',
    reports:        'Analytics',
};

type MobileNavItem = { label: string; section: Section; to: string; end?: boolean };

const MOBILE_NAV_ITEMS: MobileNavItem[] = [
    { label: 'Jobs',    section: 'jobs',           to: ROUTES.client.jobs },
    { label: 'Inv',     section: 'inventory',      to: ROUTES.client.inventory },
    { label: 'Reports', section: 'reports',        to: ROUTES.client.reports },
    { label: 'Masters', section: 'masters',        to: ROUTES.client.masters },
    { label: 'Config',  section: 'configurations', to: ROUTES.client.configurations },
];

export const ClientExplorerPanel = ({ activeSection }: Props) => {
    const { explorerOpen, toggleExplorer } = useLayout();
    const ExplorerContent = EXPLORERS[activeSection];

    // Position: left-0 on mobile (activity bar hidden), left-16 on md+ (right of activity bar)
    // Slide in/out with transform
    const translateClass = explorerOpen ? 'translate-x-0' : '-translate-x-full';

    return (
        <aside className={`fixed top-12 z-30 flex h-[calc(100%-4.5rem)] w-64 flex-col border-r border-(--cl-border) bg-(--cl-surface) transition-transform duration-200 ease-in-out left-0 md:left-16 ${translateClass}`}>
            <div className="border-b border-(--cl-border) px-3 pb-3 pt-4">
                <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-(--cl-accent-text)">
                        {SECTION_TITLES[activeSection]}
                    </p>
                    {/* Close button — only useful on mobile/tablet overlay */}
                    <button
                        onClick={toggleExplorer}
                        className="rounded p-0.5 text-(--cl-text-muted) transition-colors hover:bg-(--cl-hover) hover:text-(--cl-text) lg:hidden"
                    >
                        <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* Mobile section nav — hidden on md+ since top nav covers it */}
            <div className="border-b border-(--cl-border) px-2 py-2 md:hidden">
                <div className="grid grid-cols-3 gap-1">
                    {MOBILE_NAV_ITEMS.map(({ label, section, to, end }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            onClick={toggleExplorer}
                            className={`rounded px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                                activeSection === section
                                    ? 'bg-(--cl-accent) text-white'
                                    : 'text-(--cl-text-muted) hover:bg-(--cl-hover) hover:text-(--cl-text)'
                            }`}
                        >
                            {label}
                        </NavLink>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4">
                <ExplorerContent />
            </div>
        </aside>
    );
};
