import { createContext, useContext, useEffect, useState } from "react";
import type { ComponentType } from "react";
import {
    Activity, BarChart3, BookCheck, BookOpen, Building2, Camera, ChevronDown, ChevronRight,
    ClipboardList, DollarSign, FileText, Globe, Hash,
    LayoutDashboard, Layers, LineChart, MapPin, Package, PieChart, PlusCircle, Receipt,
    RefreshCcw, RotateCcw, Settings2, ShieldCheck, ShoppingCart,
    Tag, Timer, TrendingUp, Truck, User, UserCog, Users, Wrench,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import { useClientSelection, useLayout } from "./client-layout";
import type { Section } from "./client-layout";
import { selectCurrentUser } from "@/features/auth/store/auth-slice";
import { ACCESS_RIGHTS, hasAccessRight } from "@/features/auth/utils/access-rights";
import { ROUTES } from "@/router/routes";
import { useAppSelector } from "@/store/hooks";
import { selectPostDataToAccounts } from "@/store/context-slice";
import { HelpHint } from "@/components/shared/help/help-hint";

type Props = { activeSection: Section };

const GroupContext = createContext<string>('');

type TreeItemProps = {
    disabled?: boolean;
    icon: ComponentType<{ className?: string }>;
    iconColor?: string;
    label: string;
    title?: string;
    helpArticleId?: string;
};

function TreeItem({ disabled, icon: Icon, iconColor, label, title, helpArticleId }: TreeItemProps) {
    const { onSelect, selected } = useClientSelection();
    const group = useContext(GroupContext);
    const isActive = selected === label;

    return (
        <div className="flex items-center gap-1">
            <div
                onClick={() => { if (!disabled) onSelect(label, group || undefined); }}
                title={disabled ? title : undefined}
                aria-disabled={disabled}
                className={`group flex flex-1 items-center gap-2 rounded px-2 py-2 transition-colors duration-150 ${
                    disabled
                        ? 'cursor-not-allowed text-(--cl-text-muted) opacity-40'
                        : isActive
                            ? 'cursor-pointer bg-(--cl-accent) text-white shadow-md'
                            : 'cursor-pointer text-(--cl-text-muted) hover:bg-(--cl-hover) hover:text-(--cl-text)'
                }`}
            >
                <Icon className={`h-4 w-4 shrink-0 ${iconColor ?? (isActive && !disabled ? 'text-white' : '')}`} />
                <span className={`truncate text-sm ${isActive && !disabled ? 'font-bold' : ''}`}>{label}</span>
            </div>
            {helpArticleId && !disabled && (
                <HelpHint articleId={helpArticleId} className={isActive ? "text-white/60 hover:text-white" : ""} />
            )}
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
                <TreeItem icon={Building2}    label="Divisions"          helpArticleId="divisions" />
                <TreeItem icon={Settings2}    label="App Settings"       helpArticleId="app-settings" />
                <TreeItem icon={Hash}         label="Numbering / Auto Series" helpArticleId="document-sequences" />
            </div>
        </div>
    );
}

function InventoryExplorer() {
    const currentUser = useAppSelector(selectCurrentUser);
    const isAdmin = currentUser?.userType === "A" || currentUser?.userType === "S";

    const canPurchaseEntry   = hasAccessRight(currentUser, ACCESS_RIGHTS.INVENTORY_PURCHASE_ENTRY);
    const canSalesEntry      = hasAccessRight(currentUser, ACCESS_RIGHTS.INVENTORY_SALES_ENTRY);
    const canStockAdjustment = hasAccessRight(currentUser, ACCESS_RIGHTS.INVENTORY_STOCK_ADJUSTMENT);
    const canBranchTransfer  = hasAccessRight(currentUser, ACCESS_RIGHTS.INVENTORY_BRANCH_TRANSFER);
    const canOpeningStock    = hasAccessRight(currentUser, ACCESS_RIGHTS.INVENTORY_OPENING_STOCK);
    const canSetPartLocation = hasAccessRight(currentUser, ACCESS_RIGHTS.INVENTORY_SET_PART_LOCATION);

    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <TreeItem icon={Package}       label="Stock Overview"      helpArticleId="stock-overview" />
                <TreeItem
                    icon={ShoppingCart}
                    label="Purchase Entry"
                    disabled={!canPurchaseEntry}
                    title={!canPurchaseEntry ? "Your role does not have access to Purchase Entry" : undefined}
                    helpArticleId="purchase-entry"
                />
                <TreeItem
                    icon={Tag}
                    label="Sales Entry"
                    disabled={!canSalesEntry}
                    title={!canSalesEntry ? "Your role does not have access to Sales Entry" : undefined}
                    helpArticleId="sales-entry"
                />
                <TreeItem
                    icon={RefreshCcw}
                    label="Stock Adjustment"
                    disabled={!canStockAdjustment}
                    title={!canStockAdjustment ? "Your role does not have access to Stock Adjustment" : undefined}
                />
                <TreeItem
                    icon={Truck}
                    label="Branch Transfer"
                    disabled={!canBranchTransfer}
                    title={!canBranchTransfer ? "Your role does not have access to Branch Transfer" : undefined}
                />
                <TreeItem icon={ClipboardList} label="Loan Entry" />
                <TreeItem
                    icon={Package}
                    label="Opening Stock"
                    disabled={!canOpeningStock}
                    title={!canOpeningStock ? "Your role does not have access to Opening Stock" : undefined}
                />
                <TreeItem icon={Globe}         label="Part Finder" />
                <TreeItem
                    icon={MapPin}
                    label="Set Part Location"
                    disabled={!canSetPartLocation}
                    title={!canSetPartLocation ? "Your role does not have access to Set Part Location" : undefined}
                />
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
    const currentUser = useAppSelector(selectCurrentUser);

    const canAccountsPosting = hasAccessRight(currentUser, ACCESS_RIGHTS.JOBS_ACCOUNTS_POSTING);
    const canOpeningJobs     = hasAccessRight(currentUser, ACCESS_RIGHTS.JOBS_OPENING_JOBS);
    const canReceipts        = hasAccessRight(currentUser, ACCESS_RIGHTS.JOBS_RECEIPTS);
    const canDeliverJob      = hasAccessRight(currentUser, ACCESS_RIGHTS.JOBS_DELIVER_JOB);
    const canBatchWarranty   = hasAccessRight(currentUser, ACCESS_RIGHTS.JOBS_BATCH_WARRANTY_TRANSACTIONS);

    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <CollapsibleGroup label="New Job">
                    <TreeItem icon={PlusCircle} label="Single Job" helpArticleId="create-job" />
                    <TreeItem icon={PlusCircle} label="Batch Jobs"  helpArticleId="batch-jobs" />
                </CollapsibleGroup>
                <TreeItem icon={ClipboardList} label="Job Control" helpArticleId="job-control" />
                <TreeItem
                    icon={Layers}
                    label="Batch Warranty Jobs"
                    disabled={!canBatchWarranty}
                    title={!canBatchWarranty ? "Your role does not have access to Batch Warranty Jobs" : undefined}
                    helpArticleId="batch-warranty-jobs"
                />
                <TreeItem icon={BarChart3}     label="Job Pipeline" />
                <TreeItem icon={FileText}      label="Final a Job"  helpArticleId="finalize-job" />
                <TreeItem
                    icon={Truck}
                    label="Deliver Job"
                    disabled={!canDeliverJob}
                    title={!canDeliverJob ? "Your role does not have access to Deliver Job" : undefined}
                    helpArticleId="deliver-job"
                />
                {postDataToAccounts && (
                    <TreeItem
                        icon={BookCheck}
                        label="Accounts Posting"
                        disabled={!canAccountsPosting}
                        title={!canAccountsPosting ? "Your role does not have access to Accounts Posting" : undefined}
                    />
                )}
                <TreeItem
                    icon={RotateCcw}
                    label="Opening Jobs"
                    disabled={!canOpeningJobs}
                    title={!canOpeningJobs ? "Your role does not have access to Opening Jobs" : undefined}
                    helpArticleId="opening-jobs"
                />
                <TreeItem
                    icon={Receipt}
                    label="Receipts"
                    disabled={!canReceipts}
                    title={!canReceipts ? "Your role does not have access to Receipts" : undefined}
                    helpArticleId="receipts"
                />
                <TreeItem icon={Package}       label="Part Used (Job)" />
            </div>
        </div>
    );
}


function MastersExplorer() {
    const currentUser = useAppSelector(selectCurrentUser);
    const canOrganization  = hasAccessRight(currentUser, ACCESS_RIGHTS.MASTERS_ORGANIZATION);
    const canServiceConfig = hasAccessRight(currentUser, ACCESS_RIGHTS.MASTERS_SERVICE_CONFIG);

    const orgTitle    = !canOrganization  ? "Your role does not have access to Organization" : undefined;
    const configTitle = !canServiceConfig ? "Your role does not have access to Service Config" : undefined;

    return (
        <div className="space-y-3">
            <CollapsibleGroup label="Organization">
                <TreeItem icon={Building2} label="Branch"          disabled={!canOrganization} title={orgTitle} />
                <TreeItem icon={Hash}      label="Financial Year"  disabled={!canOrganization} title={orgTitle} />
                <TreeItem icon={MapPin}    label="State / Province" disabled={!canOrganization} title={orgTitle} />
            </CollapsibleGroup>
            <CollapsibleGroup label="Entities">
                <TreeItem icon={User}    label="Customer"         helpArticleId="customers" />
                <TreeItem icon={Truck}   label="Vendor / Supplier" helpArticleId="vendors-branches" />
                <TreeItem icon={UserCog} label="Technician"       helpArticleId="technicians" />
            </CollapsibleGroup>
            <CollapsibleGroup label="Service Config" defaultOpen={false}>
                <TreeItem icon={Users}         label="Customer Type"          disabled={!canServiceConfig} title={configTitle} />
                <TreeItem icon={FileText}      label="Document Type"          disabled={!canServiceConfig} title={configTitle} />
                <TreeItem icon={Wrench}        label="Job Type"               disabled={!canServiceConfig} title={configTitle} />
                <TreeItem icon={ClipboardList} label="Job Status"             disabled={!canServiceConfig} title={configTitle} />
                <TreeItem icon={RotateCcw}     label="Job Receive Manner"     disabled={!canServiceConfig} title={configTitle} />
                <TreeItem icon={Truck}         label="Job Delivery Manner"    disabled={!canServiceConfig} title={configTitle} />
                <TreeItem icon={Settings2}     label="Job Receive Condition"  disabled={!canServiceConfig} title={configTitle} />
                <TreeItem icon={Receipt}       label="Job Additional Charges" disabled={!canServiceConfig} title={configTitle} />
            </CollapsibleGroup>
            <CollapsibleGroup label="Product & Parts" defaultOpen={false}>
                <TreeItem icon={Tag}      label="Brand" />
                <TreeItem icon={Package}  label="Product" />
                <TreeItem icon={BookOpen} label="Model" />
                <TreeItem icon={Package}  label="Parts"        helpArticleId="parts" />
                <TreeItem icon={MapPin}   label="Part Location" />
            </CollapsibleGroup>
        </div>
    );
}

function AdminExplorer() {
    return (
        <div className="space-y-1">
            <TreeItem icon={BookCheck} label="Post / Unpost" />
        </div>
    );
}

function ReportsExplorer() {
    return (
        <div className="space-y-3">
            <div className="space-y-1">
                <TreeItem icon={LayoutDashboard} label="Dashboard" helpArticleId="job-reports" />
            </div>
            <CollapsibleGroup label="Profit Reports">
                <TreeItem icon={DollarSign} label="Technician Profit Report" />
            </CollapsibleGroup>
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
    admin:          AdminExplorer,
    configurations: ConfigurationsExplorer,
    inventory:      InventoryExplorer,
    jobs:           JobsExplorer,
    masters:        MastersExplorer,
    reports:        ReportsExplorer,
};

const SECTION_TITLES: Record<Section, string> = {
    admin:          'Administration',
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
    { label: 'Admin',   section: 'admin',          to: ROUTES.client.admin },
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
