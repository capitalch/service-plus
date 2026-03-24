import { useState } from "react";
import type { ComponentType } from "react";
import {
    BarChart3, BookOpen, Building2, ChevronDown, ChevronRight,
    ClipboardList, DollarSign, FileText, Globe, Hash,
    LayoutDashboard, MapPin, Package, PlusCircle, PrinterCheck,
    RefreshCcw, RotateCcw, Settings2, ShoppingCart,
    Tag, TrendingUp, Truck, User, UserCog, Users, Wrench,
} from "lucide-react";

import { useClientSelection } from "./client-layout";
import type { Section } from "./client-layout";

type Props = { activeSection: Section };

type TreeItemProps = {
    icon: ComponentType<{ className?: string }>;
    iconColor?: string;
    label: string;
};

function TreeItem({ icon: Icon, iconColor, label }: TreeItemProps) {
    const { onSelect, selected } = useClientSelection();
    const isActive = selected === label;

    return (
        <div
            onClick={() => onSelect(label)}
            className={`group flex cursor-pointer items-center gap-2 rounded px-2 py-2 transition-colors duration-150 ${
                isActive
                    ? 'bg-[#007acc] text-white shadow-md'
                    : 'text-[#a1a1aa] hover:bg-[#2a2a2a] hover:text-[#e5e2e1]'
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
    const [open, setOpen] = useState(defaultOpen);
    return (
        <section>
            <button
                className="mb-1 flex w-full items-center gap-1.5 rounded px-1 py-1 text-left transition-colors hover:bg-[#2a2a2a]"
                onClick={() => setOpen(o => !o)}
            >
                {open
                    ? <ChevronDown className="h-3 w-3 text-[#a1a1aa]" />
                    : <ChevronRight className="h-3 w-3 text-[#a1a1aa]" />}
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9fcaff]">{label}</p>
            </button>
            {open && <div className="ml-3 space-y-1">{children}</div>}
        </section>
    );
}

function ConfigurationsExplorer() {
    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <TreeItem icon={Building2}    label="Company Profile" />
                <TreeItem icon={Settings2}    label="Branch Configuration" />
                <TreeItem icon={Hash}         label="Numbering / Auto Series" />
            </div>
            <CollapsibleGroup label="Print Templates">
                <TreeItem icon={PrinterCheck} label="Job Slip" />
                <TreeItem icon={FileText}     label="Receipt Layouts" />
            </CollapsibleGroup>
        </div>
    );
}

function DashboardExplorer() {
    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <TreeItem icon={LayoutDashboard} label="Overview" />
                <TreeItem icon={ClipboardList}   label="Job Status" />
                <TreeItem icon={DollarSign}      label="Revenue" />
                <TreeItem icon={TrendingUp}      label="Technician Performance" />
            </div>
        </div>
    );
}

function InventoryExplorer() {
    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <TreeItem icon={Package}       label="Stock Overview" />
                <TreeItem icon={RotateCcw}     label="Consumption (Parts Usage)" />
                <TreeItem icon={ShoppingCart}  label="Purchase Entry" />
                <TreeItem icon={Tag}           label="Sales Entry" />
                <TreeItem icon={RefreshCcw}    label="Stock Adjustment" />
                <TreeItem icon={Truck}         label="Stock Transfer" />
                <TreeItem icon={ClipboardList} label="Loan / Issue & Return" />
                <TreeItem icon={Package}       label="Opening Stock" />
                <TreeItem icon={Globe}         label="Part Finder" />
            </div>
        </div>
    );
}

function JobsExplorer() {
    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <TreeItem icon={PlusCircle}    label="New Job" />
                <TreeItem icon={ClipboardList} label="Job List / Search" />
                <TreeItem icon={Wrench}        label="Update Job" />
                <TreeItem icon={FileText}      label="Ready for Delivery" />
                <TreeItem icon={Truck}         label="Deliver Job" />
                <TreeItem icon={RotateCcw}     label="Opening Jobs" />
                <TreeItem icon={DollarSign}    label="Receipts" />
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
                <TreeItem icon={Truck}   label="Vendor" />
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
            <CollapsibleGroup label="Job Reports">
                <TreeItem icon={ClipboardList} label="Job Status Report" />
                <TreeItem icon={FileText}      label="Job History" />
            </CollapsibleGroup>
            <CollapsibleGroup label="Financial Reports">
                <TreeItem icon={DollarSign} label="Revenue Report" />
                <TreeItem icon={FileText}   label="Cash Register" />
                <TreeItem icon={BarChart3}  label="Sales Report" />
            </CollapsibleGroup>
            <CollapsibleGroup label="Inventory Reports" defaultOpen={false}>
                <TreeItem icon={Package}       label="Parts Summary" />
                <TreeItem icon={ClipboardList} label="Stock Ledger" />
                <TreeItem icon={RotateCcw}     label="Stock Movement" />
            </CollapsibleGroup>
            <CollapsibleGroup label="Performance Reports" defaultOpen={false}>
                <TreeItem icon={TrendingUp} label="Technician Performance" />
                <TreeItem icon={BarChart3}  label="Summary Performance" />
                <TreeItem icon={BarChart3}  label="Detailed Performance" />
            </CollapsibleGroup>
        </div>
    );
}

const EXPLORERS: Record<Section, ComponentType> = {
    configurations: ConfigurationsExplorer,
    dashboard:      DashboardExplorer,
    inventory:      InventoryExplorer,
    jobs:           JobsExplorer,
    masters:        MastersExplorer,
    reports:        ReportsExplorer,
};

const SECTION_TITLES: Record<Section, string> = {
    configurations: 'System Configuration',
    dashboard:      'Quick Insights',
    inventory:      'Stock & Parts',
    jobs:           'Job Lifecycle',
    masters:        'Master Data',
    reports:        'Analytics',
};

export const ClientExplorerPanel = ({ activeSection }: Props) => {
    const ExplorerContent = EXPLORERS[activeSection];

    return (
        <aside className="fixed left-16 top-12 z-30 flex h-[calc(100%-4.5rem)] w-64 flex-col border-r border-white/5 bg-[#1c1c1c]">
            <div className="border-b border-white/5 px-3 pb-3 pt-6">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#9fcaff]">
                    {SECTION_TITLES[activeSection]}
                </p>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">
                <ExplorerContent />
            </div>
        </aside>
    );
};
