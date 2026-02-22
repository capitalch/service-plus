import { motion } from "framer-motion";
import { MoreHorizontalIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { selectClients, toggleClientActive } from "@/features/super-admin/super-admin-slice";
import type { ClientType } from "@/features/super-admin/types";
import { SuperAdminLayoutV3 } from "../components/super-admin-layout";

function fmtDate(d: Date) {
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export const ClientsPageV3 = () => {
    const clients = useSelector(selectClients);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [search, setSearch] = useState("");

    const filtered = clients.filter(
        (c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase())
    );

    const handleDisable = (c: ClientType) => {
        dispatch(toggleClientActive({ id: c.id, is_active: false }));
        toast.success(`${c.name} disabled`);
    };

    return (
        <SuperAdminLayoutV3>
            <motion.div animate={{ opacity: 1 }} className="flex flex-col gap-6" initial={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Business Units</h1>
                        <p className="mt-1 text-sm text-slate-500">Manage all client business units.</p>
                    </div>
                    <Button className="rounded-xl bg-violet-500 text-white hover:bg-violet-600" onClick={() => navigate("/super-admin-v3/clients/add")} size="sm">
                        <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
                        Add Client
                    </Button>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 px-5 py-4">
                        <div className="relative max-w-xs">
                            <SearchIcon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                            <Input className="pl-8 text-sm focus:border-violet-400 focus:ring-violet-100" onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or code…" value={search} />
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                                    {["Name", "Code", "Status", "Active Admins", "Inactive Admins", "Created", "Actions"].map((h) => (
                                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-400" key={h}>{h}</TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.length === 0 ? (
                                    <TableRow><TableCell className="py-10 text-center text-sm text-slate-400" colSpan={7}>No results.</TableCell></TableRow>
                                ) : filtered.map((c, i) => (
                                    <TableRow className={`hover:bg-violet-50/30 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`} key={c.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2.5">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-xs font-bold text-violet-700">{c.name.charAt(0)}</div>
                                                <span className="text-sm font-medium text-slate-900">{c.name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs text-slate-500">{c.code}</TableCell>
                                        <TableCell>
                                            <Badge className={c.is_active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-500"} variant="outline">
                                                <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${c.is_active ? "bg-emerald-500" : "bg-slate-400"}`} />
                                                {c.is_active ? "Active" : "Inactive"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm font-semibold text-violet-600">{c.activeAdminCount}</TableCell>
                                        <TableCell className="text-sm text-slate-400">{c.inactiveAdminCount}</TableCell>
                                        <TableCell className="text-xs text-slate-400">{fmtDate(c.created_at)}</TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button className="h-7 w-7" size="icon" variant="ghost"><MoreHorizontalIcon className="h-4 w-4" /></Button>
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
                </div>
            </motion.div>
        </SuperAdminLayoutV3>
    );
};
