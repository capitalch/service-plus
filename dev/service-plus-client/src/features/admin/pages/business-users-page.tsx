import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
    LinkIcon,
    MailIcon,
    MoreHorizontalIcon,
    PencilIcon,
    PlusIcon,
    RefreshCwIcon,
    SearchIcon,
    Trash2Icon,
    UserCheckIcon,
    UserXIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectBusinessUsers, setBusinessUsers } from "@/features/admin/store/admin-slice";
import { AdminLayout } from "@/features/admin/components/admin-layout";
import { ActivateBusinessUserDialog } from "@/features/admin/components/activate-business-user-dialog";
import { AssociateBuRoleDialog } from "@/features/admin/components/associate-bu-role-dialog";
import { CreateBusinessUserDialog } from "@/features/admin/components/create-business-user-dialog";
import { DeactivateBusinessUserDialog } from "@/features/admin/components/deactivate-business-user-dialog";
import { DeleteBusinessUserDialog } from "@/features/admin/components/delete-business-user-dialog";
import { EditBusinessUserDialog } from "@/features/admin/components/edit-business-user-dialog";
import { MailBusinessUserCredentialsDialog } from "@/features/admin/components/mail-business-user-credentials-dialog";
import type { BusinessUserType } from "@/features/admin/types/index";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryDataType = {
    genericQuery: BusinessUserType[] | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const cardVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: (i: number) => ({
        opacity: 1,
        transition: { delay: i * 0.05, duration: 0.25, ease: "easeOut" as const },
        y: 0,
    }),
};

// ─── Component ────────────────────────────────────────────────────────────────

export const BusinessUsersPage = () => {
    const dispatch      = useAppDispatch();
    const dbName        = useAppSelector(selectDbName);
    const businessUsers = useAppSelector(selectBusinessUsers);

    const [activateUser, setActivateUser]     = useState<BusinessUserType | null>(null);
    const [associateUser, setAssociateUser]   = useState<BusinessUserType | null>(null);
    const [createOpen, setCreateOpen]         = useState(false);
    const [deactivateUser, setDeactivateUser] = useState<BusinessUserType | null>(null);
    const [deleteUser, setDeleteUser]         = useState<BusinessUserType | null>(null);
    const [editUser, setEditUser]             = useState<BusinessUserType | null>(null);
    const [loading, setLoading]               = useState(false);
    const [mailCredentialsUser, setMailCredentialsUser] = useState<BusinessUserType | null>(null);
    const [search, setSearch]                 = useState("");

    const loadBusinessUsers = useCallback(async () => {
        if (!dbName) return;
        setLoading(true);
        try {
            const result = await apolloClient.query<GenericQueryDataType>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema: "security",
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId: SQL_MAP.GET_BUSINESS_USERS,
                    }),
                },
            });
            if (result.data?.genericQuery) {
                dispatch(setBusinessUsers(result.data.genericQuery));
            }
        } catch {
            toast.error(MESSAGES.ERROR_BUSINESS_USER_LOAD_FAILED);
        } finally {
            setLoading(false);
        }
    }, [dbName, dispatch]);

    useEffect(() => {
        loadBusinessUsers();
    }, [loadBusinessUsers]);

    const displayUsers = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return businessUsers;
        return businessUsers.filter((u) =>
            u.full_name.toLowerCase().includes(q) ||
            u.username.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            (u.role_name ?? "").toLowerCase().includes(q),
        );
    }, [businessUsers, search]);

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleActivate        = (user: BusinessUserType) => setActivateUser(user);
    const handleAssociate       = (user: BusinessUserType) => setAssociateUser(user);
    const handleCreate          = () => setCreateOpen(true);
    const handleDeactivate      = (user: BusinessUserType) => setDeactivateUser(user);
    const handleDelete          = (user: BusinessUserType) => setDeleteUser(user);
    const handleEdit            = (user: BusinessUserType) => setEditUser(user);
    const handleMailCredentials = (user: BusinessUserType) => setMailCredentialsUser(user);

    return (
        <AdminLayout>
            <motion.div
                animate={{ opacity: 1 }}
                className="flex flex-col gap-6"
                initial={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
            >
                {/* Page header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Business Users</h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Manage business user accounts and their BU/role assignments.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            className="gap-1.5 border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900"
                            disabled={loading}
                            size="sm"
                            variant="outline"
                            onClick={loadBusinessUsers}
                        >
                            <RefreshCwIcon className="h-3.5 w-3.5" />
                            Refresh
                        </Button>
                        <Button
                            className="bg-teal-600 text-white hover:bg-teal-700"
                            size="sm"
                            onClick={handleCreate}
                        >
                            <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
                            Add Business User
                        </Button>
                    </div>
                </div>

                {/* Search */}
                <div className="relative w-full sm:max-w-xs">
                    <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                        className="pl-8 text-sm"
                        placeholder="Search users…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {/* Skeleton */}
                {loading && businessUsers.length === 0 && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-44 animate-pulse rounded-xl bg-slate-100" />
                        ))}
                    </div>
                )}

                {/* Empty state */}
                {!loading && displayUsers.length === 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-400 shadow-sm">
                        {search.trim()
                            ? "No users match your search."
                            : "No business users found. Click \u201cAdd Business User\u201d to create one."}
                    </div>
                )}

                {/* Scrollable card grid */}
                {displayUsers.length > 0 && (
                    <div
                        className="overflow-y-auto rounded-xl pr-1"
                        style={{ maxHeight: "calc(100vh - 200px)" }}
                    >
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {displayUsers.map((user, idx) => (
                                <motion.div
                                    animate="visible"
                                    custom={idx}
                                    initial="hidden"
                                    key={user.id}
                                    variants={cardVariants}
                                >
                                    <Card className={`relative overflow-hidden border transition-shadow hover:shadow-md ${
                                        user.is_active
                                            ? "border-slate-200 bg-white"
                                            : "border-l-4 border-l-red-300 bg-red-50/30"
                                    }`}>
                                        <CardContent className="p-4">

                                            {/* Top row: avatar + name + action menu */}
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                                                        user.is_active
                                                            ? "bg-teal-100 text-teal-700"
                                                            : "bg-slate-200 text-slate-400"
                                                    }`}>
                                                        {user.full_name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className={`truncate text-sm font-semibold ${
                                                            user.is_active
                                                                ? "text-slate-900"
                                                                : "text-slate-400 line-through decoration-slate-300"
                                                        }`}>
                                                            {user.full_name}
                                                        </p>
                                                        <p className="truncate font-mono text-xs text-slate-400">
                                                            {user.username}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Index badge */}
                                                <span className="shrink-0 rounded-full bg-teal-600 px-2.5 py-1 font-mono text-xs font-bold text-white shadow-sm">
                                                    #{idx + 1}
                                                </span>

                                                {/* Action menu */}
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            className="h-7 w-7 shrink-0 cursor-pointer text-slate-400 hover:text-slate-700"
                                                            size="icon"
                                                            variant="ghost"
                                                        >
                                                            <MoreHorizontalIcon className="h-4 w-4" />
                                                            <span className="sr-only">Actions</span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-44">
                                                        <DropdownMenuItem
                                                            className="cursor-pointer text-blue-600 focus:text-blue-600"
                                                            disabled={!user.is_active}
                                                            onClick={() => handleEdit(user)}
                                                        >
                                                            <PencilIcon className="mr-2 h-4 w-4 text-blue-600" />
                                                            Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="cursor-pointer text-blue-600 focus:text-blue-600"
                                                            disabled={!user.is_active}
                                                            onClick={() => handleMailCredentials(user)}
                                                        >
                                                            <MailIcon className="mr-1.5 h-3.5 w-3.5" />
                                                            Reset password and mail
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="cursor-pointer text-teal-600 focus:text-teal-600"
                                                            disabled={!user.is_active}
                                                            onClick={() => handleAssociate(user)}
                                                        >
                                                            <LinkIcon className="mr-1.5 h-3.5 w-3.5" />
                                                            Associate BU / Role
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        {user.is_active ? (
                                                            <DropdownMenuItem
                                                                className="cursor-pointer text-amber-600 focus:text-amber-600"
                                                                onClick={() => handleDeactivate(user)}
                                                            >
                                                                <UserXIcon className="mr-1.5 h-3.5 w-3.5" />
                                                                Deactivate
                                                            </DropdownMenuItem>
                                                        ) : (
                                                            <>
                                                                <DropdownMenuItem
                                                                    className="cursor-pointer text-emerald-600 focus:text-emerald-600"
                                                                    onClick={() => handleActivate(user)}
                                                                >
                                                                    <UserCheckIcon className="mr-1.5 h-3.5 w-3.5" />
                                                                    Activate
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    className="cursor-pointer text-red-600 focus:text-red-600"
                                                                    onClick={() => handleDelete(user)}
                                                                >
                                                                    <Trash2Icon className="mr-1.5 h-3.5 w-3.5" />
                                                                    Delete
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>

                                            {/* Email */}
                                            <p className={`mt-3 truncate text-xs ${user.is_active ? "text-slate-500" : "text-slate-400"}`}>
                                                {user.email}
                                            </p>

                                            {/* Mobile */}
                                            <p className="mt-0.5 text-xs text-slate-400">
                                                {user.mobile ?? "—"}
                                            </p>

                                            {/* BU + Role */}
                                            <div className="mt-3 flex flex-wrap items-center gap-1.5">
                                                {user.bu_ids && user.bu_ids.length > 0 ? (
                                                    <span className="inline-flex items-center rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700">
                                                        {user.bu_ids.length} BU{user.bu_ids.length !== 1 ? "s" : ""}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-400">No BU</span>
                                                )}
                                                {user.role_name ? (
                                                    <Badge
                                                        className="border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-50"
                                                        variant="outline"
                                                    >
                                                        {user.role_name}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-xs text-slate-400">No role</span>
                                                )}
                                            </div>

                                            {/* Status */}
                                            <div className="mt-3">
                                                <Badge
                                                    className={
                                                        user.is_active
                                                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                                                            : "border-red-200 bg-red-100 text-red-500 hover:bg-red-100"
                                                    }
                                                    variant="outline"
                                                >
                                                    <span className={`mr-1 h-1.5 w-1.5 rounded-full ${
                                                        user.is_active ? "bg-emerald-500" : "bg-red-400"
                                                    }`} />
                                                    {user.is_active ? "Active" : "Inactive"}
                                                </Badge>
                                            </div>

                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}
            </motion.div>

            {/* ── Dialogs ──────────────────────────────────────────────────────── */}
            <CreateBusinessUserDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onSuccess={loadBusinessUsers}
            />
            {editUser && (
                <EditBusinessUserDialog
                    open={!!editUser}
                    user={editUser}
                    onOpenChange={(open) => { if (!open) setEditUser(null); }}
                    onSuccess={loadBusinessUsers}
                />
            )}
            {activateUser && (
                <ActivateBusinessUserDialog
                    open={!!activateUser}
                    user={activateUser}
                    onOpenChange={(open) => { if (!open) setActivateUser(null); }}
                    onSuccess={loadBusinessUsers}
                />
            )}
            {deactivateUser && (
                <DeactivateBusinessUserDialog
                    open={!!deactivateUser}
                    user={deactivateUser}
                    onOpenChange={(open) => { if (!open) setDeactivateUser(null); }}
                    onSuccess={loadBusinessUsers}
                />
            )}
            {deleteUser && (
                <DeleteBusinessUserDialog
                    open={!!deleteUser}
                    user={deleteUser}
                    onOpenChange={(open) => { if (!open) setDeleteUser(null); }}
                    onSuccess={loadBusinessUsers}
                />
            )}
            {mailCredentialsUser && (
                <MailBusinessUserCredentialsDialog
                    open={!!mailCredentialsUser}
                    user={mailCredentialsUser}
                    onOpenChange={(open) => { if (!open) setMailCredentialsUser(null); }}
                    onSuccess={loadBusinessUsers}
                />
            )}
            {associateUser && (
                <AssociateBuRoleDialog
                    open={!!associateUser}
                    user={associateUser}
                    onOpenChange={(open) => { if (!open) setAssociateUser(null); }}
                    onSuccess={loadBusinessUsers}
                />
            )}
        </AdminLayout>
    );
};
