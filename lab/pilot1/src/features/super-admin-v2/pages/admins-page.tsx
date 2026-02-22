import { motion } from "framer-motion";
import {
    CheckCircle2Icon,
    MinusCircleIcon,
    MoreHorizontalIcon,
    PlusIcon,
    SearchIcon,
    ShieldIcon,
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
import { selectAdminUsers, toggleAdminUserActive } from "@/features/super-admin/super-admin-slice";
import type { AdminUserRoleType, AdminUserType } from "@/features/super-admin/types";

const roleStyles: Record<AdminUserRoleType, string> = {
    ClientAdmin: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50",
    SuperAdmin: "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-50",
    Viewer: "border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-100",
};

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

const handleEdit = (user: AdminUserType) => toast.info(`Editing ${user.full_name}`);
const handleView = (user: AdminUserType) => toast.info(`Viewing ${user.full_name}`);

export const AdminsPage = () => {
    const adminUsers = useSelector(selectAdminUsers);
    const dispatch = useDispatch();
    const [search, setSearch] = useState("");

    const activeCount = adminUsers.filter((u) => u.is_active).length;
    const inactiveCount = adminUsers.filter((u) => !u.is_active).length;

    const filtered = adminUsers.filter(
        (u) =>
            u.full_name.toLowerCase().includes(search.toLowerCase()) ||
            u.email.toLowerCase().includes(search.toLowerCase()) ||
            u.bu_name.toLowerCase().includes(search.toLowerCase()) ||
            u.username.toLowerCase().includes(search.toLowerCase())
    );

    const handleAddAdmin = () => toast.info("Add Admin clicked");

    const handleDeactivate = (user: AdminUserType) => {
        dispatch(toggleAdminUserActive({ id: user.id, is_active: false }));
        toast.success(`${user.full_name} has been deactivated`);
    };

    const statCards = [
        { accent: "text-violet-600", icon: ShieldIcon, iconBg: "bg-violet-100", label: "Total Admins", value: adminUsers.length },
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
                        <h1 className="text-xl font-bold text-slate-900">Admins</h1>
                        <p className="mt-1 text-sm text-slate-500">Manage administrator accounts, roles, and permissions.</p>
                    </div>
                    <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={handleAddAdmin} size="sm">
                        <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
                        Add Admin
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
                                placeholder="Search by name, email, username, BU…"
                                value={search}
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Full Name</TableHead>
                                    <TableHead className="hidden text-xs font-semibold uppercase tracking-wide text-slate-500 sm:table-cell">Email</TableHead>
                                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role</TableHead>
                                    <TableHead className="hidden text-xs font-semibold uppercase tracking-wide text-slate-500 md:table-cell">Business Unit</TableHead>
                                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</TableHead>
                                    <TableHead className="hidden text-xs font-semibold uppercase tracking-wide text-slate-500 lg:table-cell">Last Login</TableHead>
                                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.length === 0 ? (
                                    <TableRow>
                                        <TableCell className="py-8 text-center text-sm text-slate-400" colSpan={7}>
                                            No admins match your search.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filtered.map((user, index) => (
                                        <TableRow
                                            className={`transition-colors hover:bg-emerald-50/40 ${index % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}
                                            key={user.id}
                                        >
                                            <TableCell className="font-medium text-slate-900">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-cyan-100 text-xs font-bold text-cyan-700">
                                                        {user.full_name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium">{user.full_name}</div>
                                                        <div className="mt-0.5 text-xs text-slate-400 sm:hidden">{user.email}</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden text-sm text-slate-600 sm:table-cell">{user.email}</TableCell>
                                            <TableCell>
                                                <Badge className={roleStyles[user.role]} variant="outline">{user.role}</Badge>
                                            </TableCell>
                                            <TableCell className="hidden text-sm text-slate-600 md:table-cell">{user.bu_name}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    className={user.is_active
                                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                                                        : "border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-100"}
                                                    variant="outline"
                                                >
                                                    {user.is_active ? "Active" : "Inactive"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="hidden text-sm text-slate-600 lg:table-cell">{formatDate(user.last_login_at)}</TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button className="h-7 w-7" size="icon" variant="ghost">
                                                            <MoreHorizontalIcon className="h-4 w-4" />
                                                            <span className="sr-only">Actions</span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-36">
                                                        <DropdownMenuItem onClick={() => handleView(user)}>View</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleEdit(user)}>Edit</DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="text-red-600 focus:text-red-600"
                                                            disabled={!user.is_active}
                                                            onClick={() => handleDeactivate(user)}
                                                        >
                                                            Deactivate
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
