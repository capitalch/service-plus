import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
	ArrowDownIcon,
	ArrowUpDownIcon,
	ArrowUpIcon,
	MoreHorizontalIcon,
	PencilIcon,
	PlusIcon,
	RefreshCwIcon,
	SearchIcon,
	ToggleLeftIcon,
	ToggleRightIcon,
	Trash2Icon,
	Users,
	X,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectCurrentUser, selectDbName } from "@/features/auth/store/auth-slice";
import { ActivateBusinessUserDialog } from "@/features/admin/components/activate-business-user-dialog";
import { DeactivateBusinessUserDialog } from "@/features/admin/components/deactivate-business-user-dialog";
import { DeleteBusinessUserDialog } from "@/features/admin/components/delete-business-user-dialog";
import { EditBusinessUserDialog } from "@/features/admin/components/edit-business-user-dialog";
import type { BusinessUserType } from "@/features/admin/types/index";
import { AddUserDialog } from "./add-user-dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryDataType = { genericQuery: BusinessUserType[] | null };

// ─── Constants ────────────────────────────────────────────────────────────────

const rowVariants = {
	hidden: { opacity: 0, y: 6 },
	visible: (i: number) => ({
		opacity: 1,
		transition: { delay: i * 0.04, duration: 0.22, ease: "easeOut" as const },
		y: 0,
	}),
};

const thClass = "text-xs font-semibold uppercase tracking-wide text-(--cl-text-muted)";
const thSortClass = `${thClass} cursor-pointer select-none hover:text-(--cl-text)`;

// ─── Component ────────────────────────────────────────────────────────────────

export const UsersSection = () => {
	const currentUser = useAppSelector(selectCurrentUser);
	const dbName = useAppSelector(selectDbName);
	// availableBus already IS "every BU this user is listed against" — for a Manager
	// that's exactly their own managed BU(s), since role is applied uniformly across
	// every BU picked when the Manager themself was created/edited.
	const myBuIds = useMemo(() => new Set((currentUser?.availableBus ?? []).map((bu) => bu.id)), [currentUser]);

	const [activateUser, setActivateUser] = useState<BusinessUserType | null>(null);
	const [addOpen, setAddOpen] = useState(false);
	const [deactivateUser, setDeactivateUser] = useState<BusinessUserType | null>(null);
	const [deleteUser, setDeleteUser] = useState<BusinessUserType | null>(null);
	const [editUser, setEditUser] = useState<BusinessUserType | null>(null);
	const [loading, setLoading] = useState(false);
	const [search, setSearch] = useState("");
	const [sortCol, setSortCol] = useState<string | null>(null);
	const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
	const [users, setUsers] = useState<BusinessUserType[]>([]);

	// A Manager only ever manages their own BU(s), and never another Manager — the
	// same restriction the server enforces independently when creating/editing
	// (users_roles.py, _require_can_create_business_user). GET_BUSINESS_USERS has no
	// BU filter of its own, so this list is narrowed down client-side.
	const loadUsers = useCallback(async () => {
		if (!dbName) return;
		setLoading(true);
		try {
			const result = await apolloClient.query<GenericQueryDataType>({
				fetchPolicy: "network-only",
				query: GRAPHQL_MAP.genericQuery,
				variables: {
					db_name: dbName,
					schema: "security",
					value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_BUSINESS_USERS }),
				},
			});
			const all = result.data?.genericQuery ?? [];
			setUsers(all.filter((u) => u.role_name !== "Manager" && u.bu_ids.some((buId) => myBuIds.has(buId))));
		} catch {
			toast.error(MESSAGES.ERROR_BUSINESS_USER_LOAD_FAILED);
		} finally {
			setLoading(false);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [dbName, currentUser]);

	useEffect(() => {
		loadUsers();
	}, [loadUsers]);

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
		let rows = users;
		if (search.trim()) {
			const q = search.toLowerCase();
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
	}, [users, search, sortCol, sortDir]);

	if ((currentUser?.availableBus ?? []).length === 0) {
		return (
			<div className="flex items-center justify-center rounded-lg border border-(--cl-border) bg-(--cl-surface-2) p-20">
				<div className="text-center">
					<p className="text-sm font-semibold text-(--cl-text)">No Business Unit</p>
					<p className="mt-2 text-xs text-(--cl-text-muted)">
						No business unit is assigned. Please contact your administrator.
					</p>
				</div>
			</div>
		);
	}

	return (
		<>
			<motion.div
				animate={{ opacity: 1 }}
				className="flex min-h-0 flex-1 flex-col gap-4"
				initial={{ opacity: 0 }}
				transition={{ duration: 0.25 }}
			>
				{/* Page header */}
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="flex items-center gap-3">
						<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-(--cl-accent)/10 text-(--cl-accent)">
							<Users className="h-4 w-4 text-teal-600" />
						</div>
						<div>
							<h1 className="text-xl font-bold text-(--cl-text)">Users</h1>
							<p className="mt-1 text-sm text-(--cl-text-muted)">{MESSAGES.INFO_USERS_DESCRIPTION}</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<Button
							className="gap-1.5 border border-(--cl-border) bg-(--cl-surface-2) text-(--cl-text-muted) shadow-sm hover:bg-(--cl-surface-3)"
							disabled={loading}
							size="sm"
							variant="outline"
							onClick={loadUsers}
						>
							<RefreshCwIcon className="h-3.5 w-3.5 text-blue-600" />
							Refresh
						</Button>
						<Button
							className="bg-teal-600 text-white hover:bg-teal-700"
							size="sm"
							onClick={() => setAddOpen(true)}
						>
							<PlusIcon className="mr-1.5 h-3.5 w-3.5" />
							Add User
						</Button>
					</div>
				</div>

				{/* Search + count */}
				<div className="flex items-center gap-3">
					<div className="relative flex-1 sm:max-w-xs">
						<SearchIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
						<Input
							className="h-8 pl-8 text-sm"
							disabled={loading}
							placeholder="Search users…"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
						{search && (
							<button
								className="absolute right-2.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-(--cl-text-muted) text-(--cl-surface) hover:bg-(--cl-text) focus:outline-none"
								type="button"
								onClick={() => setSearch("")}
							>
								<X className="h-2.5 w-2.5 text-muted-foreground" />
							</button>
						)}
					</div>
					{!loading && users.length > 0 && (
						<p className="shrink-0 text-xs text-(--cl-text-muted)">
							{displayUsers.length} of {users.length}
						</p>
					)}
				</div>

				{/* Table */}
				{loading && users.length === 0 ? (
					<div className="flex flex-col gap-2">
						{Array.from({ length: 4 }).map((_, i) => (
							<div key={i} className="h-12 animate-pulse rounded-lg bg-(--cl-surface-2)" />
						))}
					</div>
				) : users.length === 0 ? (
					<div className="rounded-xl border border-(--cl-border) bg-(--cl-surface-2) px-6 py-12 text-center text-sm text-(--cl-text-muted)">
						No users found. Click &quot;Add User&quot; to create one.
					</div>
				) : (
					<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-(--cl-border) bg-(--cl-surface-2) shadow-sm">
						<div className="overflow-x-auto overflow-y-auto">
							<Table>
								<TableHeader>
									<TableRow className="sticky top-0 z-10 bg-(--cl-surface-3) hover:bg-(--cl-surface-3)">
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
											<td
												colSpan={99}
												className="px-6 py-10 text-center text-sm text-(--cl-text-muted)"
											>
												No results match &ldquo;{search}&rdquo;.
											</td>
										</tr>
									) : (
										displayUsers.map((user, idx) => (
											<motion.tr
												animate="visible"
												className="border-b border-(--cl-border) transition-colors last:border-b-0 hover:bg-(--cl-surface-3)"
												custom={idx}
												initial="hidden"
												key={user.id}
												variants={rowVariants}
											>
												<TableCell className="text-center text-xs text-(--cl-text-muted)">
													{idx + 1}
												</TableCell>
												<TableCell className="font-medium text-(--cl-text)">
													{user.full_name}
												</TableCell>
												<TableCell>
													<span className="font-mono text-xs font-semibold text-(--cl-text)">
														{user.username}
													</span>
												</TableCell>
												<TableCell className="text-sm text-(--cl-text-muted)">
													{user.email}
												</TableCell>
												<TableCell className="text-sm text-(--cl-text-muted)">
													{user.mobile ?? "—"}
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
														<span className="text-xs text-(--cl-text-muted)">No role</span>
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
															className={`mr-1 h-1.5 w-1.5 rounded-full ${user.is_active ? "bg-emerald-500" : "bg-slate-400"}`}
														/>
														{user.is_active ? "Active" : "Inactive"}
													</Badge>
												</TableCell>
												<TableCell>
													<DropdownMenu>
														<DropdownMenuTrigger asChild>
															<Button
																className="h-7 w-7 cursor-pointer text-(--cl-text-muted) hover:text-(--cl-text)"
																size="icon"
																variant="ghost"
															>
																<MoreHorizontalIcon className="h-4 w-4" />
																<span className="sr-only">Actions</span>
															</Button>
														</DropdownMenuTrigger>
														<DropdownMenuContent align="end" className="w-44">
															<DropdownMenuItem
																className="cursor-pointer text-sky-600 focus:text-sky-600"
																disabled={!user.is_active}
																onClick={() => setEditUser(user)}
															>
																<PencilIcon className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
																Edit
															</DropdownMenuItem>
															<DropdownMenuSeparator />
															{user.is_active ? (
																<DropdownMenuItem
																	className="cursor-pointer text-amber-600 focus:text-amber-600"
																	onClick={() => setDeactivateUser(user)}
																>
																	<ToggleLeftIcon className="mr-1.5 h-3.5 w-3.5" />
																	Deactivate
																</DropdownMenuItem>
															) : (
																<DropdownMenuItem
																	className="cursor-pointer text-emerald-600 focus:text-emerald-600"
																	onClick={() => setActivateUser(user)}
																>
																	<ToggleRightIcon className="mr-1.5 h-3.5 w-3.5" />
																	Activate
																</DropdownMenuItem>
															)}
															<DropdownMenuSeparator />
															<DropdownMenuItem
																className="cursor-pointer text-red-600 focus:text-red-600"
																onClick={() => setDeleteUser(user)}
															>
																<Trash2Icon className="mr-1.5 h-3.5 w-3.5 text-red-600" />
																Delete
															</DropdownMenuItem>
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
			<AddUserDialog open={addOpen} onOpenChange={setAddOpen} onSuccess={loadUsers} />
			{editUser && (
				<EditBusinessUserDialog
					open={!!editUser}
					user={editUser}
					onOpenChange={(open) => {
						if (!open) setEditUser(null);
					}}
					onSuccess={loadUsers}
				/>
			)}
			{activateUser && (
				<ActivateBusinessUserDialog
					open={!!activateUser}
					user={activateUser}
					onOpenChange={(open) => {
						if (!open) setActivateUser(null);
					}}
					onSuccess={loadUsers}
				/>
			)}
			{deactivateUser && (
				<DeactivateBusinessUserDialog
					open={!!deactivateUser}
					user={deactivateUser}
					onOpenChange={(open) => {
						if (!open) setDeactivateUser(null);
					}}
					onSuccess={loadUsers}
				/>
			)}
			{deleteUser && (
				<DeleteBusinessUserDialog
					open={!!deleteUser}
					user={deleteUser}
					onOpenChange={(open) => {
						if (!open) setDeleteUser(null);
					}}
					onSuccess={loadUsers}
				/>
			)}
		</>
	);
};
