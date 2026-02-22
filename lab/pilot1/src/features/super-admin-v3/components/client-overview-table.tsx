import { motion } from "framer-motion";
import { MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
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

function fmtDate(d: Date) {
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export const ClientOverviewTableV3 = () => {
    const clients = useSelector(selectClients);
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const handleDisable = (c: ClientType) => {
        dispatch(toggleClientActive({ id: c.id, is_active: false }));
        toast.success(`${c.name} disabled`);
    };

    return (
        <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            initial={{ opacity: 0, y: 12 }}
            transition={{ delay: 0.2, duration: 0.35, ease: "easeOut" }}
        >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <div>
                    <h2 className="text-sm font-semibold text-slate-900">Client Overview</h2>
                    <p className="text-xs text-slate-400">All registered business units</p>
                </div>
                <Button
                    className="bg-violet-500 text-white hover:bg-violet-600 rounded-xl"
                    onClick={() => navigate("/super-admin-v3/clients/add")}
                    size="sm"
                >
                    <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
                    Add Client
                </Button>
            </div>

            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                            {["Client Name", "Code", "Status", "Active Admins", "Created"].map((h) => (
                                <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-400" key={h}>{h}</TableHead>
                            ))}
                            <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-400">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {clients.map((c, i) => (
                            <TableRow className={`hover:bg-violet-50/30 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`} key={c.id}>
                                <TableCell>
                                    <div className="flex items-center gap-2.5">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-xs font-bold text-violet-700">
                                            {c.name.charAt(0)}
                                        </div>
                                        <span className="text-sm font-medium text-slate-900">{c.name}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="font-mono text-xs text-slate-500">{c.code}</TableCell>
                                <TableCell>
                                    <Badge
                                        className={c.is_active
                                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                            : "border-slate-200 bg-slate-100 text-slate-500"}
                                        variant="outline"
                                    >
                                        <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${c.is_active ? "bg-emerald-500" : "bg-slate-400"}`} />
                                        {c.is_active ? "Active" : "Inactive"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-sm font-semibold text-violet-600">{c.activeAdminCount}</TableCell>
                                <TableCell className="text-xs text-slate-400">{fmtDate(c.created_at)}</TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button className="h-7 w-7" size="icon" variant="ghost">
                                                <MoreHorizontalIcon className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-36">
                                            <DropdownMenuItem onClick={() => toast.info(`Viewing ${c.name}`)}>View</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => toast.info(`Editing ${c.name}`)}>Edit</DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="text-red-600" disabled={!c.is_active} onClick={() => handleDisable(c)}>Disable</DropdownMenuItem>
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
