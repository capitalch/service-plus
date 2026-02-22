import { motion } from "framer-motion";
import { MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { selectClients, toggleClientActive } from "@/features/super-admin/super-admin-slice";
import type { ClientType } from "@/features/super-admin/types";

function formatDate(date: Date): string {
    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

const handleEdit = (client: ClientType) => toast.info(`Editing ${client.name}`);
const handleView = (client: ClientType) => toast.info(`Viewing ${client.name}`);

export const ClientOverviewTable = () => {
    const clients = useSelector(selectClients);
    const dispatch = useDispatch();

    const handleAddClient = () => toast.info("Add Client clicked");

    const handleDisable = (client: ClientType) => {
        dispatch(toggleClientActive({ id: client.id, is_active: false }));
        toast.success(`${client.name} has been disabled`);
    };

    return (
        <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            initial={{ opacity: 0, y: 12 }}
            transition={{ delay: 0.2, duration: 0.35, ease: "easeOut" }}
        >
            {/* Section header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div>
                    <h2 className="text-sm font-semibold text-slate-900">Client Overview</h2>
                    <p className="mt-0.5 text-xs text-slate-500">All registered business units</p>
                </div>
                <Button
                    className="bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500"
                    onClick={handleAddClient}
                    size="sm"
                >
                    <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
                    Add Client
                </Button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                            <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Client Name</TableHead>
                            <TableHead className="hidden text-xs font-semibold uppercase tracking-wide text-slate-500 sm:table-cell">Client Code</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</TableHead>
                            <TableHead className="hidden text-xs font-semibold uppercase tracking-wide text-slate-500 md:table-cell">Active Admins</TableHead>
                            <TableHead className="hidden text-xs font-semibold uppercase tracking-wide text-slate-500 md:table-cell">Inactive Admins</TableHead>
                            <TableHead className="hidden text-xs font-semibold uppercase tracking-wide text-slate-500 lg:table-cell">Created On</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {clients.map((client, index) => (
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
                                            <div className="text-sm font-medium text-slate-900">{client.name}</div>
                                            <div className="mt-0.5 text-xs text-slate-400 sm:hidden">{client.code}</div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="hidden text-sm font-mono text-slate-600 sm:table-cell">{client.code}</TableCell>
                                <TableCell>
                                    <Badge
                                        className={client.is_active
                                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                                            : "border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-100"}
                                        variant="outline"
                                    >
                                        <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${client.is_active ? "bg-emerald-500" : "bg-slate-400"}`} />
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
                                            <Button className="h-7 w-7 text-slate-400 hover:text-slate-700" size="icon" variant="ghost">
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
                        ))}
                    </TableBody>
                </Table>
            </div>
        </motion.div>
    );
};
