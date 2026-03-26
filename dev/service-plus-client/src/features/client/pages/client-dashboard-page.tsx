import { Filter, LayoutList, TrendingUp } from "lucide-react";

import { ClientLayout } from "../components/client-layout";

const STATS = [
    { label: 'Active Jobs',    value: '12',      sub: '+2 from yesterday', subColor: 'text-[var(--cl-accent-text)]' },
    { label: 'Pending Pickup', value: '05',      sub: '3 Overdue',         subColor: 'text-[#ffb784]' },
    { label: 'Revenue Today',  value: '₹24,500', trending: true },
    { label: 'Customers',      value: '847',     sub: 'Total database',    subColor: 'text-[var(--cl-text-muted)]' },
];

const JOBS = [
    {
        id: 'JOB-2024-001', device: 'iPhone 15 Pro Max',  issue: 'Liquid Damage / Screen Replacement',
        customer: 'Rahul Sharma', status: 'In Progress',  statusColor: 'bg-[#b95e01]/20 text-[#ffb784]',
        tech: 'Anil K.',    initials: 'AK', due: 'Oct 24, 2024',
    },
    {
        id: 'JOB-2024-002', device: 'MacBook Pro M2',     issue: 'Battery Expansion Service',
        customer: 'Priya Patel',  status: 'Parts Arrived', statusColor: 'bg-[#007acc]/20 text-[var(--cl-accent-text)]',
        tech: 'Sushant K.', initials: 'SK', due: 'Oct 25, 2024',
    },
    {
        id: 'JOB-2024-003', device: 'Samsung Galaxy S24', issue: 'Motherboard IC Repair',
        customer: 'Amit Singh',   status: 'Critical',      statusColor: 'bg-[#93000a]/20 text-[#ffb4ab]',
        tech: 'Rohan V.',   initials: 'RV', due: 'Oct 24, 2024',
    },
    {
        id: 'JOB-2024-004', device: 'iPad Air (5th Gen)', issue: 'USB-C Port Replacement',
        customer: 'Karan Mehra',  status: 'Awaiting Auth', statusColor: 'bg-[#2c4968]/20 text-[#adc9ee]',
        tech: 'Anil K.',    initials: 'AK', due: 'Oct 26, 2024',
    },
];

export const ClientDashboardPage = () => (
    <ClientLayout>
        {/* Stats cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
            {STATS.map(({ label, value, sub, subColor, trending }) => (
                <div key={label} className="rounded border border-[var(--cl-border)] bg-[var(--cl-surface-2)] p-4 shadow-sm">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--cl-text-muted)]">{label}</p>
                    <div className="flex items-end gap-3">
                        <span className="text-3xl font-light text-[var(--cl-text)]">{value}</span>
                        {trending && <TrendingUp className="mb-1 h-4 w-4 text-[var(--cl-accent-text)]" />}
                        {sub && <span className={`pb-1 text-[10px] ${subColor}`}>{sub}</span>}
                    </div>
                </div>
            ))}
        </div>

        {/* Repair queue table */}
        <section className="overflow-hidden rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-2)] shadow-2xl">
            <div className="flex items-center justify-between bg-[var(--cl-hover)] px-6 py-4">
                <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-[var(--cl-text)]">
                    <LayoutList className="h-4 w-4 text-[var(--cl-accent-text)]" />
                    Recent Repair Queue
                </h2>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-1 text-[10px] font-bold uppercase text-[var(--cl-text-muted)] hover:text-[var(--cl-text)]">
                        <Filter className="h-3.5 w-3.5" /> Filter
                    </button>
                    <button className="text-[10px] font-bold uppercase text-[var(--cl-accent-text)] hover:underline">
                        View All
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                    <thead>
                        <tr className="border-b border-[var(--cl-border)] bg-[var(--cl-surface-3)] text-[10px] font-bold uppercase tracking-wider text-[var(--cl-text-muted)]">
                            <th className="px-6 py-3">Job ID</th>
                            <th className="px-6 py-3">Device &amp; Issue</th>
                            <th className="px-6 py-3">Customer</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3">Technician</th>
                            <th className="px-6 py-3">Due Date</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--cl-divider)]">
                        {JOBS.map(({ id, device, issue, customer, status, statusColor, tech, initials, due }) => (
                            <tr key={id} className="cursor-pointer transition-colors hover:bg-[var(--cl-hover)]">
                                <td className="px-6 py-4 font-mono text-[var(--cl-accent-text)]">{id}</td>
                                <td className="px-6 py-4">
                                    <div className="font-medium text-[var(--cl-text)]">{device}</div>
                                    <div className="text-[10px] text-[var(--cl-text-muted)]">{issue}</div>
                                </td>
                                <td className="px-6 py-4 text-[var(--cl-text)]">{customer}</td>
                                <td className="px-6 py-4">
                                    <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight ${statusColor}`}>
                                        {status}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--cl-accent)]/20 text-[10px] font-bold text-[var(--cl-accent-text)]">
                                            {initials}
                                        </div>
                                        <span className="text-[var(--cl-text)]">{tech}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-[var(--cl-text-muted)]">{due}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    </ClientLayout>
);
