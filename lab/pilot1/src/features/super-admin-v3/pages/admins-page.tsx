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
import { selectAdminUsers, toggleAdminUserActive } from "@/features/super-admin/super-admin-slice";
import type { AdminUserRoleType, AdminUserType } from "@/features/super-admin/types";
import { SuperAdminLayoutV3 } from "../components/super-admin-layout";

const roleStyles: Record<AdminUserRoleType, string> = {
    ClientAdmin: "border-violet-200 bg-violet-50 text-violet-700",
    SuperAdmin: "border-slate-800 bg-slate-900 text-slate-100",
    Viewer: "border-slate-200 bg-slate-100 text-slate-500",
};

function fmtDate(d: Date) {
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export const AdminsPageV3 = () => {
    const adminUsers = useSelector(selectAdminUsers);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [search, setSearch] = useState("");

    const filtered = adminUsers.filter(
        (u) => u.full_name.toLowerCase().includes(search.toLowerCase()) ||
            u.email.toLowerCase().includes(search.toLowerCase()) ||
            u.username.toLowerCase().includes(search.toLowerCase())
    );

    const handleDeactivate = (u: AdminUserType) => {
        dispatch(toggleAdminUserActive({ id: u.id, is_active: false }));
        toast.success(`${u.full_name} deactivated`);
    };

    return (
        <SuperAdminLayoutV3>
            <motion.div animate={{ opacity: 1 }} className="flex flex-col gap-6" initial={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Admin Users</h1>
                        <p className="mt-1 text-sm text-slate-500">Manage administrator accounts and roles.</p>
                    </div>
                    <Button className="rounded-xl bg-violet-500 text-white hover:bg-violet-600" onClick={() => navigate("/super-admin-v3/admins/add")} size="sm">
                        <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
                        Add Admin
                    </Button>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 px-5 py-4">
                        <div className="relative max-w-xs">
                            <SearchIcon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                            <Input className="pl-8 text-sm focus:border-violet-400 focus:ring-violet-100" onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email…" value={search} />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                                    {["Name", "Email", "Role", "Business Unit", "Status", "Last Login", "Actions"].map((h) => (
                                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-400" key={h}>{h}</TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.length === 0 ? (
                                    <TableRow><TableCell className="py-10 text-center text-sm text-slate-400" colSpan={7}>No results.</TableCell></TableRow>
                                ) : filtered.map((u, i) => (
                                    <TableRow className={`hover:bg-violet-50/30 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`} key={u.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2.5">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#180a2e] text-xs font-bold text-violet-300">
                                                    {u.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-slate-900">{u.full_name}</div>
                                                    <div className="text-xs text-slate-400">@{u.username}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-slate-600">{u.email}</TableCell>
                                        <TableCell>
                                            <Badge className={roleStyles[u.role]} variant="outline">{u.role}</Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-slate-600">{u.bu_name}</TableCell>
                                        <TableCell>
                                            <Badge className={u.is_active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-500"} variant="outline">
                                                <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${u.is_active ? "bg-emerald-500" : "bg-slate-400"}`} />
                                                {u.is_active ? "Active" : "Inactive"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs text-slate-400">{fmtDate(u.last_login_at)}</TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button className="h-7 w-7" size="icon" variant="ghost"><MoreHorizontalIcon className="h-4 w-4" /></Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-36">
                                                    <DropdownMenuItem onClick={() => toast.info(`Viewing ${u.full_name}`)}>View</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => toast.info(`Editing ${u.full_name}`)}>Edit</DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem className="text-red-600" disabled={!u.is_active} onClick={() => handleDeactivate(u)}>Deactivate</DropdownMenuItem>
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
