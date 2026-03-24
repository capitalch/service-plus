import type { ComponentType } from "react";
import { useState } from "react";
import {
    BarChart3, BookOpen, Building2, ChevronDown, ChevronRight,
    ClipboardList, DollarSign, FileText, Globe, Hash,
    LayoutDashboard, MapPin, Package, PlusCircle, PrinterCheck,
    RefreshCcw, RotateCcw, Settings2, ShoppingCart,
    Tag, TrendingUp, Truck, User, UserCog, Users, Wrench,
} from "lucide-react";

import type { Section } from "./client-layout";

type Props = { activeSection: Section };

function SectionHeader({ label }: { label: string }) {
    return (
        <div className="mb-2 flex items-center gap-2 text-[#e5e2e1]">
            <ChevronDown className="h-3.5 w-3.5" />
            <p className="text-[11px] font-semibold uppercase tracking-wider">{label}</p>
        </div>
    );
}

type TreeItemProps = {
    active?: boolean;
    icon: ComponentType<{ className?: string }>;
    iconColor?: string;
    label: string;
};

function TreeItem({ active = false, icon: Icon, iconColor, label }: TreeItemProps) {
    return (
        <div
            className={`group flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 transition-colors duration-150 ${
                active ? 'bg-[#2a2a2a] text-[#e5e2e1]' : 'text-[#a1a1aa] hover:bg-[#2a2a2a] hover:text-[#e5e2e1]'
            }`}
        >
            <Icon className={`h-4 w-4 shrink-0 ${iconColor ?? (active ? 'text-[#007acc]' : '')}`} />
            <span className="truncate text-[11px]">{label}</span>
        </div>
    );
}

function ActionItem({ icon: Icon, label }: { icon: ComponentType<{ className?: string }>; label: string }) {
    return (
        <button className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[11px] text-[#9fcaff] transition-colors duration-150 hover:bg-[#2a2a2a] active:scale-95">
            <Icon className="h-4 w-4 shrink-0" />
            <span>{label}</span>
        </button>
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
            <SectionHeader label="System Configuration" />
            <div className="space-y-1">
                <TreeItem icon={Building2}  label="Company Profile" />
                <TreeItem icon={Settings2}  label="Branch Configuration" />
                <TreeItem icon={Hash}       label="Numbering / Auto Series" />
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
            <SectionHeader label="Quick Insights" />
            <div className="space-y-1">
                <TreeItem icon={LayoutDashboard} label="Overview" active />
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
            <SectionHeader label="Stock + Parts Operations" />
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
            <section>
                <div className="space-y-1">
                    <ActionItem icon={PlusCircle} label="New Job" />
                </div>
            </section>
            <SectionHeader label="Job Lifecycle" />
            <div className="space-y-1">
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
            <SectionHeader label="Master Data" />
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
            <SectionHeader label="Analytics" />
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

const SECTION_LABELS: Record<Section, string> = {
    configurations: 'Configurations Console',
    dashboard:      'Navigation Console',
    inventory:      'Inventory Console',
    jobs:           'Jobs Console',
    masters:        'Masters Console',
    reports:        'Reports Console',
};

export const ClientExplorerPanel = ({ activeSection }: Props) => {
    const ExplorerContent = EXPLORERS[activeSection];

    return (
        <aside className="fixed left-16 top-12 z-30 flex h-[calc(100%-4.5rem)] w-64 flex-col border-r border-white/5 bg-[#1c1c1c]">
            <div className="border-b border-white/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#9fcaff]">Explorer</p>
                <p className="mt-1 text-[9px] text-[#a1a1aa]">{SECTION_LABELS[activeSection]}</p>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">
                <ExplorerContent />
            </div>
        </aside>
    );
};
