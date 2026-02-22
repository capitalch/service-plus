import { motion } from "framer-motion";
import {
    BuildingIcon,
    CheckCircle2Icon,
    MinusCircleIcon,
    MoreHorizontalIcon,
    PlusIcon,
    SearchIcon,
} from "lucide-react";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { SuperAdminLayout } from "../components/super-admin-layout";
import { selectClients, toggleClientActive } from "@/features/super-admin/super-admin-slice";
import type { ClientType } from "@/features/super-admin/types";

const cardVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: (i: number) => ({
        opacity: 1,
        transition: { delay: i * 0.07, duration: 0.3, ease: "easeOut" as const },
        y: 0,
    }),
};

function formatDate(date: Date): string {
    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

const handleEdit = (client: ClientType) => toast.info(`Editing ${client.name}`);
const handleView = (client: ClientType) => toast.info(`Viewing ${client.name}`);

export const ClientsPage = () => {
    const clients = useSelector(selectClients);
    const dispatch = useDispatch();
    const [search, setSearch] = useState("");

    const filtered = clients.filter(
        (c) =>
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.code.toLowerCase().includes(search.toLowerCase())
    );

    const activeCount = clients.filter((c) => c.is_active).length;
    const inactiveCount = clients.filter((c) => !c.is_active).length;

    const handleAddClient = () => toast.info("Add Client clicked");

    const handleDisable = (client: ClientType) => {
        dispatch(toggleClientActive({ id: client.id, is_active: false }));
        toast.success(`${client.name} has been disabled`);
    };

    const statCards = [
        { accent: "text-emerald-600", icon: BuildingIcon, iconBg: "bg-emerald-100", label: "Total Business Units", value: clients.length },
        { accent: "text-emerald-600", icon: CheckCircle2Icon, iconBg: "bg-emerald-100", label: "Active", value: activeCount },
        { accent: "text-slate-500", icon: MinusCircleIcon, iconBg: "bg-slate-100", label: "Inactive", value: inactiveCount },
    ];

    return (
        <SuperAdminLayout>
            <motion.div
                animate={{ opacity: 1 }}
                className="flex flex-col gap-6"
                initial={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
            >
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Business Units</h1>
                        <p className="mt-1 text-sm text-slate-500">Manage all business units and their administrators.</p>
                    </div>
                    <Button
                        className="bg-emerald-600 text-white hover:bg-emerald-700"
                        onClick={handleAddClient}
                        size="sm"
                    >
                        <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
                        Add Client
                    </Button>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    {statCards.map((card, i) => {
                        const Icon = card.icon;
                        return (
                            <motion.div animate="visible" custom={i} initial="hidden" key={card.label} variants={cardVariants}>
                                <Card className="border border-slate-200/80 bg-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
                                    <CardContent className="p-4">
                                        <div className="mb-3 flex items-center justify-between">
                                            <p className="text-xs font-medium text-slate-500">{card.label}</p>
                                            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.iconBg}`}>
                                                <Icon className={`h-4 w-4 ${card.accent}`} />
                                            </div>
                                        </div>
                                        <p className={`text-2xl font-bold ${card.accent}`}>{card.value}</p>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        );
                    })}
                </div>

                <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                    initial={{ opacity: 0, y: 12 }}
                    transition={{ delay: 0.15, duration: 0.3, ease: "easeOut" }}
                >
                    <div className="border-b border-slate-100 px-5 py-4">
                        <div className="relative max-w-xs">
                            <SearchIcon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                            <Input
                                className="pl-8 text-sm"
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by name or code…"
                                value={search}
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</TableHead>
                                    <TableHead className="hidden text-xs font-semibold uppercase tracking-wide text-slate-500 sm:table-cell">Code</TableHead>
                                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</TableHead>
                                    <TableHead className="hidden text-xs font-semibold uppercase tracking-wide text-slate-500 md:table-cell">Active Admins</TableHead>
                                    <TableHead className="hidden text-xs font-semibold uppercase tracking-wide text-slate-500 md:table-cell">Inactive Admins</TableHead>
                                    <TableHead className="hidden text-xs font-semibold uppercase tracking-wide text-slate-500 lg:table-cell">Created On</TableHead>
                                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.length === 0 ? (
                                    <TableRow>
                                        <TableCell className="py-8 text-center text-sm text-slate-400" colSpan={7}>
                                            No business units match your search.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filtered.map((client, index) => (
                                        <TableRow
                                            className={`transition-colors hover:bg-emerald-50/40 ${index % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}
                                            key={client.id}
                                        >
                                            <TableCell className="font-medium text-slate-900">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-emerald-100 text-xs font-bold text-emerald-700">
                                                        {client.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium">{client.name}</div>
                                                        <div className="mt-0.5 text-xs text-slate-400 sm:hidden">{client.code}</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden text-sm font-mono text-slate-600 sm:table-cell">{client.code}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    className={client.is_active
                                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                                                        : "border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-100"
                                                    }
                                                    variant="outline"
                                                >
                                                    {client.is_active ? "Active" : "Inactive"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="hidden text-sm text-slate-700 md:table-cell">
                                                <span className="font-semibold text-teal-600">{client.activeAdminCount}</span>
                                            </TableCell>
                                            <TableCell className="hidden text-sm text-slate-700 md:table-cell">
                                                <span className="font-semibold text-slate-400">{client.inactiveAdminCount}</span>
                                            </TableCell>
                                            <TableCell className="hidden text-sm text-slate-500 lg:table-cell">{formatDate(client.created_at)}</TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button className="h-7 w-7" size="icon" variant="ghost">
                                                            <MoreHorizontalIcon className="h-4 w-4" />
                                                            <span className="sr-only">Actions</span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-36">
                                                        <DropdownMenuItem onClick={() => handleView(client)}>View</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleEdit(client)}>Edit</DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="text-red-600 focus:text-red-600"
                                                            disabled={!client.is_active}
                                                            onClick={() => handleDisable(client)}
                                                        >
                                                            Disable
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </motion.div>
            </motion.div>
        </SuperAdminLayout>
    );
};
