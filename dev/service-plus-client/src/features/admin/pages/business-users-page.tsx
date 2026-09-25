import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
	ArrowDownIcon,
	ArrowUpDownIcon,
	ArrowUpIcon,
	BuildingIcon,
	ChevronDownIcon,
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
	X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import {
	selectBusinessUnits,
	selectBusinessUsers,
	setBusinessUnits,
	setBusinessUsers,
} from "@/features/admin/store/admin-slice";
import { AdminLayout } from "@/features/admin/components/admin-layout";
import { ActivateBusinessUserDialog } from "@/features/admin/components/activate-business-user-dialog";
import { AssociateBuRoleDialog } from "@/features/admin/components/associate-bu-role-dialog";
import { CreateBusinessUserDialog } from "@/features/admin/components/create-business-user-dialog";
import { DeactivateBusinessUserDialog } from "@/features/admin/components/deactivate-business-user-dialog";
import { DeleteBusinessUserDialog } from "@/features/admin/components/delete-business-user-dialog";
import { EditBusinessUserDialog } from "@/features/admin/components/edit-business-user-dialog";
import { MailBusinessUserCredentialsDialog } from "@/features/admin/components/mail-business-user-credentials-dialog";
import type { BusinessUnitType, BusinessUserType } from "@/features/admin/types/index";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryDataType = {
	genericQuery: BusinessUserType[] | null;
};

type GenericBuQueryDataType = {
	genericQuery: BusinessUnitType[] | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const rowVariants = {
	hidden: { opacity: 0, y: 6 },
	visible: (i: number) => ({
		opacity: 1,
		transition: { delay: i * 0.04, duration: 0.22, ease: "easeOut" as const },
		y: 0,
	}),
};

const thClass = "text-xs font-semibold uppercase tracking-wide text-slate-500";
const thSortClass = `${thClass} cursor-pointer select-none hover:text-slate-900`;

// ─── Component ────────────────────────────────────────────────────────────────

export const BusinessUsersPage = () => {
	const dispatch = useAppDispatch();
	const dbName = useAppSelector(selectDbName);
	const businessUnits = useAppSelector(selectBusinessUnits);
	const businessUsers = useAppSelector(selectBusinessUsers);

	const [activateUser, setActivateUser] = useState<BusinessUserType | null>(null);
	const [associateUser, setAssociateUser] = useState<BusinessUserType | null>(null);
	const [createOpen, setCreateOpen] = useState(false);
	const [deactivateUser, setDeactivateUser] = useState<BusinessUserType | null>(null);
	const [deleteUser, setDeleteUser] = useState<BusinessUserType | null>(null);
	const [editUser, setEditUser] = useState<BusinessUserType | null>(null);
	const [loading, setLoading] = useState(false);
	const [mailCredentialsUser, setMailCredentialsUser] = useState<BusinessUserType | null>(null);
	const [search, setSearch] = useState("");
	const [sortCol, setSortCol] = useState<string | null>(null);
	const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

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

	const loadBusinessUnits = useCallback(async () => {
		if (!dbName) return;
		try {
			const result = await apolloClient.query<GenericBuQueryDataType>({
				fetchPolicy: "network-only",
				query: GRAPHQL_MAP.genericQuery,
				variables: {
					db_name: dbName,
					schema: "security",
					value: graphQlUtils.buildGenericQueryValue({
						sqlId: SQL_MAP.GET_ALL_BUS,
					}),
				},
			});
			if (result.data?.genericQuery) {
				dispatch(setBusinessUnits(result.data.genericQuery));
			}
		} catch {
			// BU names are supplementary to the row; a failed fetch just falls back to "N BUs".
		}
	}, [dbName, dispatch]);

	useEffect(() => {
		loadBusinessUsers();
	}, [loadBusinessUsers]);

	useEffect(() => {
		if (businessUnits.length === 0) loadBusinessUnits();
	}, [businessUnits.length, loadBusinessUnits]);

	const buNameById = useMemo(() => {
		const map = new Map<number, string>();
		businessUnits.forEach((bu) => map.set(bu.id, bu.name));
		return map;
	}, [businessUnits]);

	function handleSort(col: string) {
		if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
		else {
			setSortCol(col);
			setSortDir("asc");
		}
	}

	function SortIcon({ col }: { col: string }) {
		if (sortCol !== col) return <ArrowUpDownIcon className="ml-1 inline h-3 w-3 opacity-40" />;
		return sortDir === "asc" ? (
			<ArrowUpIcon className="ml-1 inline h-3 w-3" />
		) : (
			<ArrowDownIcon className="ml-1 inline h-3 w-3" />
		);
	}

	const displayUsers = useMemo(() => {
		let rows = businessUsers;
		if (search.trim()) {
			const q = search.trim().toLowerCase();
			rows = rows.filter(
				(u) =>
					u.full_name.toLowerCase().includes(q) ||
					u.username.toLowerCase().includes(q) ||
					u.email.toLowerCase().includes(q) ||
					(u.role_name ?? "").toLowerCase().includes(q),
			);
		}
		if (sortCol) {
			rows = [...rows].sort((a, b) => {
				const av = (a as Record<string, unknown>)[sortCol];
				const bv = (b as Record<string, unknown>)[sortCol];
				if (av == null) return 1;
				if (bv == null) return -1;
				const cmp = typeof av === "number" ? av - (bv as number) : String(av).localeCompare(String(bv));
				return sortDir === "asc" ? cmp : -cmp;
			});
		}
		return rows;
	}, [businessUsers, search, sortCol, sortDir]);

	// ── Handlers ─────────────────────────────────────────────────────────────
	const handleActivate = (user: BusinessUserType) => setActivateUser(user);
	const handleAssociate = (user: BusinessUserType) => setAssociateUser(user);
	const handleCreate = () => setCreateOpen(true);
	const handleDeactivate = (user: BusinessUserType) => setDeactivateUser(user);
	const handleDelete = (user: BusinessUserType) => setDeleteUser(user);
	const handleEdit = (user: BusinessUserType) => setEditUser(user);
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
							<RefreshCwIcon className="h-3.5 w-3.5 text-blue-600" />
							Refresh
						</Button>
						<Button className="bg-teal-600 text-white hover:bg-teal-700" size="sm" onClick={handleCreate}>
							<PlusIcon className="mr-1.5 h-3.5 w-3.5" />
							Add Business User
						</Button>
					</div>
				</div>

				{/* Search + count */}
				<div className="flex items-center gap-3">
					<div className="relative w-full sm:max-w-xs">
						<SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
						<Input
							className="pl-8 text-sm"
							placeholder="Search users…"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
						{search && (
							<button
								className="absolute right-2.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-slate-400 text-white hover:bg-slate-600 focus:outline-none"
								type="button"
								onClick={() => setSearch("")}
							>
								<X className="h-2.5 w-2.5" />
							</button>
						)}
					</div>
					{!loading && businessUsers.length > 0 && (
						<p className="shrink-0 text-xs text-slate-500">
							{displayUsers.length} of {businessUsers.length}
						</p>
					)}
				</div>

				{/* Skeleton */}
				{loading && businessUsers.length === 0 && (
					<div className="flex flex-col gap-2">
						{Array.from({ length: 6 }).map((_, i) => (
							<div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
						))}
					</div>
				)}

				{/* Empty state */}
				{!loading && businessUsers.length === 0 && (
					<div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-400 shadow-sm">
						No business users found. Click &quot;Add Business User&quot; to create one.
					</div>
				)}

				{/* Grid */}
				{businessUsers.length > 0 && (
					<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
						<div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: "calc(100vh - 260px)" }}>
							<Table>
								<TableHeader>
									<TableRow className="sticky top-0 z-10 bg-slate-50 hover:bg-slate-50">
										<TableHead className={`w-8 text-center ${thClass}`}>#</TableHead>
										<TableHead className={thSortClass} onClick={() => handleSort("full_name")}>
											Name
											<SortIcon col="full_name" />
										</TableHead>
										<TableHead className={thSortClass} onClick={() => handleSort("username")}>
											Username
											<SortIcon col="username" />
										</TableHead>
										<TableHead className={thSortClass} onClick={() => handleSort("email")}>
											Email
											<SortIcon col="email" />
										</TableHead>
										<TableHead className={thClass}>Mobile</TableHead>
										<TableHead className={thClass}>Business Units</TableHead>
										<TableHead className={thSortClass} onClick={() => handleSort("role_name")}>
											Role
											<SortIcon col="role_name" />
										</TableHead>
										<TableHead className={thClass}>Status</TableHead>
										<TableHead className={thClass}>Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{displayUsers.length === 0 ? (
										<tr>
											<td colSpan={99} className="px-6 py-10 text-center text-sm text-slate-400">
												No results match &ldquo;{search}&rdquo;.
											</td>
										</tr>
									) : (
										displayUsers.map((user, idx) => (
											<motion.tr
												animate="visible"
												className={`border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50 ${
													user.is_active ? "" : "bg-slate-50/60"
												}`}
												custom={idx}
												initial="hidden"
												key={user.id}
												variants={rowVariants}
											>
												<TableCell className="text-center text-xs text-slate-400">
													{idx + 1}
												</TableCell>
												<TableCell>
													<div className="flex items-center gap-2.5">
														<div
															className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
																user.is_active
																	? "bg-teal-100 text-teal-700"
																	: "bg-slate-200 text-slate-400"
															}`}
														>
															{user.full_name.charAt(0).toUpperCase()}
														</div>
														<span
															className={`font-medium ${
																user.is_active
																	? "text-slate-900"
																	: "text-slate-400 line-through decoration-slate-300"
															}`}
														>
															{user.full_name}
														</span>
													</div>
												</TableCell>
												<TableCell>
													<span className="font-mono text-xs font-semibold text-slate-700">
														{user.username}
													</span>
												</TableCell>
												<TableCell className="text-sm text-slate-500">{user.email}</TableCell>
												<TableCell className="text-sm text-slate-500">
													{user.mobile ?? "—"}
												</TableCell>
												<TableCell>
													{user.bu_ids && user.bu_ids.length > 0 ? (
														<DropdownMenu>
															<DropdownMenuTrigger asChild>
																<button
																	className="inline-flex cursor-pointer items-center gap-1 rounded-sm bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700 hover:bg-teal-200"
																	type="button"
																>
																	{user.bu_ids.length} BU
																	{user.bu_ids.length !== 1 ? "s" : ""}
																	<ChevronDownIcon className="h-3 w-3" />
																</button>
															</DropdownMenuTrigger>
															<DropdownMenuContent align="start" className="w-52">
																<DropdownMenuLabel className="text-xs text-slate-500">
																	Business Units
																</DropdownMenuLabel>
																<DropdownMenuSeparator />
																{user.bu_ids.map((buId) => (
																	<DropdownMenuItem
																		className="cursor-default text-xs text-slate-700 focus:bg-transparent focus:text-slate-700"
																		key={buId}
																		onSelect={(e) => e.preventDefault()}
																	>
																		<BuildingIcon className="mr-1.5 h-3.5 w-3.5 text-teal-600" />
																		{buNameById.get(buId) ?? `BU #${buId}`}
																	</DropdownMenuItem>
																))}
															</DropdownMenuContent>
														</DropdownMenu>
													) : (
														<span className="text-xs text-slate-400">No BU</span>
													)}
												</TableCell>
												<TableCell>
													{user.role_name ? (
														<Badge
															className="rounded-sm border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-50"
															variant="outline"
														>
															{user.role_name}
														</Badge>
													) : (
														<span className="text-xs text-slate-400">No role</span>
													)}
												</TableCell>
												<TableCell>
													<Badge
														className={
															user.is_active
																? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
																: "border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-100"
														}
														variant="outline"
													>
														<span
															className={`mr-1 h-1.5 w-1.5 rounded-full ${
																user.is_active ? "bg-emerald-500" : "bg-slate-400"
															}`}
														/>
														{user.is_active ? "Active" : "Inactive"}
													</Badge>
												</TableCell>
												<TableCell>
													<DropdownMenu>
														<DropdownMenuTrigger asChild>
															<Button
																className="h-7 w-7 cursor-pointer text-slate-400 hover:text-slate-700"
																size="icon"
																variant="ghost"
															>
																<MoreHorizontalIcon className="h-4 w-4" />
																<span className="sr-only">Actions</span>
															</Button>
														</DropdownMenuTrigger>
														<DropdownMenuContent align="end" className="w-48">
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
																<MailIcon className="mr-1.5 h-3.5 w-3.5 text-indigo-600" />
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
																		<Trash2Icon className="mr-1.5 h-3.5 w-3.5 text-red-600" />
																		Delete
																	</DropdownMenuItem>
																</>
															)}
														</DropdownMenuContent>
													</DropdownMenu>
												</TableCell>
											</motion.tr>
										))
									)}
								</TableBody>
							</Table>
						</div>
					</div>
				)}
			</motion.div>

			{/* ── Dialogs ──────────────────────────────────────────────────────── */}
			<CreateBusinessUserDialog open={createOpen} onOpenChange={setCreateOpen} onSuccess={loadBusinessUsers} />
			{editUser && (
				<EditBusinessUserDialog
					open={!!editUser}
					user={editUser}
					onOpenChange={(open) => {
						if (!open) setEditUser(null);
					}}
					onSuccess={loadBusinessUsers}
				/>
			)}
			{activateUser && (
				<ActivateBusinessUserDialog
					open={!!activateUser}
					user={activateUser}
					onOpenChange={(open) => {
						if (!open) setActivateUser(null);
					}}
					onSuccess={loadBusinessUsers}
				/>
			)}
			{deactivateUser && (
				<DeactivateBusinessUserDialog
					open={!!deactivateUser}
					user={deactivateUser}
					onOpenChange={(open) => {
						if (!open) setDeactivateUser(null);
					}}
					onSuccess={loadBusinessUsers}
				/>
			)}
			{deleteUser && (
				<DeleteBusinessUserDialog
					open={!!deleteUser}
					user={deleteUser}
					onOpenChange={(open) => {
						if (!open) setDeleteUser(null);
					}}
					onSuccess={loadBusinessUsers}
				/>
			)}
			{mailCredentialsUser && (
				<MailBusinessUserCredentialsDialog
					open={!!mailCredentialsUser}
					user={mailCredentialsUser}
					onOpenChange={(open) => {
						if (!open) setMailCredentialsUser(null);
					}}
					onSuccess={loadBusinessUsers}
				/>
			)}
			{associateUser && (
				<AssociateBuRoleDialog
					open={!!associateUser}
					user={associateUser}
					onOpenChange={(open) => {
						if (!open) setAssociateUser(null);
					}}
					onSuccess={loadBusinessUsers}
				/>
			)}
		</AdminLayout>
	);
};
