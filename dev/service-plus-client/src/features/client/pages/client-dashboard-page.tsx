import { Filter, LayoutList, TrendingUp } from "lucide-react";

import { ClientLayout } from "../components/client-layout";

const STATS = [
    { label: 'Active Jobs',    value: '12',      sub: '+2 from yesterday', subColor: 'text-[#9fcaff]' },
    { label: 'Pending Pickup', value: '05',      sub: '3 Overdue',         subColor: 'text-[#ffb784]' },
    { label: 'Revenue Today',  value: '₹24,500', trending: true },
    { label: 'Customers',      value: '847',     sub: 'Total database',    subColor: 'text-[#a1a1aa]' },
];

const JOBS = [
    {
        id: 'JOB-2024-001', device: 'iPhone 15 Pro Max',  issue: 'Liquid Damage / Screen Replacement',
        customer: 'Rahul Sharma', status: 'In Progress',  statusColor: 'bg-[#b95e01]/20 text-[#ffb784]',
        tech: 'Anil K.',    initials: 'AK', due: 'Oct 24, 2024',
    },
    {
        id: 'JOB-2024-002', device: 'MacBook Pro M2',     issue: 'Battery Expansion Service',
        customer: 'Priya Patel',  status: 'Parts Arrived', statusColor: 'bg-[#007acc]/20 text-[#9fcaff]',
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
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-[#a1a1aa]">
            <span>Console</span>
            <span className="text-[#9fcaff]">/ Dashboard</span>
        </div>

        {/* Stats cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
            {STATS.map(({ label, value, sub, subColor, trending }) => (
                <div key={label} className="rounded border border-white/5 bg-[#202020] p-4 shadow-sm">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#a1a1aa]">{label}</p>
                    <div className="flex items-end gap-3">
                        <span className="text-3xl font-light text-[#e5e2e1]">{value}</span>
                        {trending && <TrendingUp className="mb-1 h-4 w-4 text-[#9fcaff]" />}
                        {sub && <span className={`pb-1 text-[10px] ${subColor}`}>{sub}</span>}
                    </div>
                </div>
            ))}
        </div>

        {/* Repair queue table */}
        <section className="overflow-hidden rounded-lg border border-white/5 bg-[#202020] shadow-2xl">
            <div className="flex items-center justify-between bg-[#2a2a2a]/50 px-6 py-4">
                <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-[#e5e2e1]">
                    <LayoutList className="h-4 w-4 text-[#9fcaff]" />
                    Recent Repair Queue
                </h2>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-1 text-[10px] font-bold uppercase text-[#a1a1aa] hover:text-[#e5e2e1]">
                        <Filter className="h-3.5 w-3.5" /> Filter
                    </button>
                    <button className="text-[10px] font-bold uppercase text-[#9fcaff] hover:underline">
                        View All
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                    <thead>
                        <tr className="border-b border-white/5 bg-[#1b1b1c] text-[10px] font-bold uppercase tracking-wider text-[#a1a1aa]">
                            <th className="px-6 py-3">Job ID</th>
                            <th className="px-6 py-3">Device &amp; Issue</th>
                            <th className="px-6 py-3">Customer</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3">Technician</th>
                            <th className="px-6 py-3">Due Date</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {JOBS.map(({ id, device, issue, customer, status, statusColor, tech, initials, due }) => (
                            <tr key={id} className="cursor-pointer transition-colors hover:bg-[#2a2a2a]/50">
                                <td className="px-6 py-4 font-mono text-[#9fcaff]">{id}</td>
                                <td className="px-6 py-4">
                                    <div className="font-medium text-[#e5e2e1]">{device}</div>
                                    <div className="text-[10px] text-[#a1a1aa]">{issue}</div>
                                </td>
                                <td className="px-6 py-4 text-[#e5e2e1]">{customer}</td>
                                <td className="px-6 py-4">
                                    <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight ${statusColor}`}>
                                        {status}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#9fcaff]/20 text-[10px] font-bold text-[#9fcaff]">
                                            {initials}
                                        </div>
                                        <span className="text-[#e5e2e1]">{tech}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-[#a1a1aa]">{due}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    </ClientLayout>
);
