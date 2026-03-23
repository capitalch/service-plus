import type { ComponentType } from "react";
import {
    AlertCircle, BarChart3, Building2, ChevronDown, ClipboardList,
    FileText, Package, PlusCircle, RotateCcw, Settings,
    ShoppingCart, User, UserPlus, Users, Wrench,
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
    icon: ComponentType<{ className?: string }>;
    label: string;
    active?: boolean;
    iconColor?: string;
};

function TreeItem({ icon: Icon, label, active = false, iconColor }: TreeItemProps) {
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

function DashboardExplorer() {
    return (
        <div className="space-y-6">
            <section>
                <SectionHeader label="Active Jobs" />
                <div className="ml-4 space-y-1">
                    <TreeItem icon={AlertCircle} label="JOB-2024-001 iPhone 15" active />
                    <TreeItem icon={AlertCircle} label="JOB-2024-002 MacBook Pro" />
                    <TreeItem icon={AlertCircle} label="JOB-2024-003 Samsung S24" />
                </div>
            </section>
            <section>
                <SectionHeader label="Recent Customers" />
                <div className="ml-4 space-y-1">
                    <TreeItem icon={User} label="Rahul Sharma" />
                    <TreeItem icon={User} label="Priya Patel" />
                    <TreeItem icon={User} label="Amit Singh" />
                </div>
            </section>
            <section>
                <SectionHeader label="Quick Actions" />
                <div className="ml-4 space-y-1">
                    <ActionItem icon={PlusCircle} label="New Job" />
                    <ActionItem icon={UserPlus} label="New Customer" />
                    <ActionItem icon={FileText} label="Create Invoice" />
                </div>
            </section>
        </div>
    );
}

function JobsExplorer() {
    return (
        <div className="space-y-6">
            <section>
                <div className="space-y-1">
                    <ActionItem icon={PlusCircle} label="New Job" />
                </div>
            </section>
            <section>
                <SectionHeader label="Job Queue" />
                <div className="ml-4 space-y-1">
                    <TreeItem icon={AlertCircle} label="Open (4)" />
                    <TreeItem icon={AlertCircle} label="In Progress (3)" />
                    <TreeItem icon={AlertCircle} label="Awaiting Parts (2)" />
                    <TreeItem icon={AlertCircle} label="Ready for Pickup (5)" />
                    <TreeItem icon={AlertCircle} label="Critical (1)" iconColor="text-[#ffb4ab]" />
                </div>
            </section>
            <section>
                <SectionHeader label="History" />
                <div className="ml-4 space-y-1">
                    <TreeItem icon={ClipboardList} label="Closed Today (8)" />
                </div>
            </section>
        </div>
    );
}

function CustomersExplorer() {
    return (
        <div className="space-y-6">
            <section>
                <div className="space-y-1">
                    <ActionItem icon={UserPlus} label="New Customer" />
                </div>
            </section>
            <section>
                <SectionHeader label="Browse" />
                <div className="ml-4 space-y-1">
                    <TreeItem icon={Users} label="All Customers" />
                    <TreeItem icon={ClipboardList} label="Customer Types" />
                </div>
            </section>
        </div>
    );
}

function InventoryExplorer() {
    return (
        <div className="space-y-4">
            <section>
                <SectionHeader label="Master Data" />
                <div className="ml-4 space-y-1">
                    <TreeItem icon={Package} label="Parts Master" />
                    <TreeItem icon={Building2} label="Brands" />
                    <TreeItem icon={Users} label="Suppliers" />
                </div>
            </section>
            <section>
                <SectionHeader label="Transactions" />
                <div className="ml-4 space-y-1">
                    <TreeItem icon={ShoppingCart} label="Purchase Invoices" />
                    <TreeItem icon={FileText} label="Sales Invoices" />
                    <TreeItem icon={RotateCcw} label="Stock Transactions" />
                    <TreeItem icon={ClipboardList} label="Stock Adjustments" />
                </div>
            </section>
        </div>
    );
}

function ReportsExplorer() {
    return (
        <div className="space-y-4">
            <section>
                <SectionHeader label="Reports" />
                <div className="ml-4 space-y-1">
                    <TreeItem icon={ClipboardList} label="Job Status Report" />
                    <TreeItem icon={FileText} label="Cash Register" />
                    <TreeItem icon={BarChart3} label="Performance Report" />
                    <TreeItem icon={BarChart3} label="Sales Report" />
                    <TreeItem icon={BarChart3} label="Operational Report" />
                </div>
            </section>
        </div>
    );
}

function SettingsExplorer() {
    return (
        <div className="space-y-4">
            <section>
                <SectionHeader label="Configuration" />
                <div className="ml-4 space-y-1">
                    <TreeItem icon={Building2} label="Company Info" />
                    <TreeItem icon={Building2} label="Branch Setup" />
                    <TreeItem icon={Wrench} label="Technicians" />
                    <TreeItem icon={Package} label="Products & Models" />
                    <TreeItem icon={FileText} label="Document Sequences" />
                    <TreeItem icon={Settings} label="Job Conditions" />
                </div>
            </section>
        </div>
    );
}

const EXPLORERS: Record<Section, ComponentType> = {
    dashboard: DashboardExplorer,
    jobs:      JobsExplorer,
    customers: CustomersExplorer,
    inventory: InventoryExplorer,
    reports:   ReportsExplorer,
    settings:  SettingsExplorer,
};

const SECTION_LABELS: Record<Section, string> = {
    dashboard: 'Navigation Console',
    jobs:      'Jobs Console',
    customers: 'Customers Console',
    inventory: 'Inventory Console',
    reports:   'Reports Console',
    settings:  'Settings Console',
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
