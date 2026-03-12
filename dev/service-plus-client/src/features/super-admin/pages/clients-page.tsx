import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
	ArrowDownIcon,
	ArrowUpDownIcon,
	ArrowUpIcon,
	BanIcon,
	BuildingIcon,
	CheckCircle2Icon,
	ChevronRightIcon,
	DatabaseIcon,
	MinusCircleIcon,
	MoreHorizontalIcon,
	PlusIcon,
	RefreshCwIcon,
	SearchIcon,
	ServerCrashIcon,
	ShieldIcon,
	UsersIcon,
	XCircleIcon,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { useQuery } from "@apollo/client/react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/page-loader";
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

import { ActivateAdminDialog } from "../components/activate-admin-dialog";
import { ActivateClientDialog } from "../components/activate-client-dialog";
import { AddClientDialog } from "../components/add-client-dialog";
import { AttachDbDialog } from "../components/attach-db-dialog";
import { CreateAdminDialog } from "../components/create-admin-dialog";
import { DeactivateAdminDialog } from "../components/deactivate-admin-dialog";
import { DeactivateClientDialog } from "../components/deactivate-client-dialog";
import { DeleteClientDialog } from "../components/delete-client-dialog";
import { DetachDbDialog } from "../components/detach-db-dialog";
import { EditAdminDialog } from "../components/edit-admin-dialog";
import { EditClientDialog } from "../components/edit-client-dialog";
import { MailAdminCredentialsDialog } from "../components/mail-admin-credentials-dialog";
import { InitializeClientDialog } from "../components/initialize-client-dialog";
import { OrphanDatabasesDialog } from "../components/orphan-databases-dialog";
import { SuperAdminLayout } from "../components/super-admin-layout";
import { ViewClientDialog } from "../components/view-client-dialog";
import { selectClients, setClients } from "@/features/super-admin/store/super-admin-slice";
import type { ClientAdminType, ClientType } from "@/features/super-admin/types";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";

// ─── Types ────────────────────────────────────────────────────────────────────

type ClientsPageStatsType = {
	activeAdmins: number;
	activeClients: number;
	inactiveAdmins: number;
	inactiveClients: number;
	orphanDatabaseCount: number;
	orphanDatabases: string[];
	totalAdmins: number;
	totalClients: number;
};

type ClientsPageDataType = {
	superAdminClientsData: ClientsPageStatsType & { clients: ClientType[] };
};

type SortDirType = "asc" | "desc";
type SortFieldType = "created_at" | "name";
type SortStateType = { dir: SortDirType; field: SortFieldType };

// ─── Constants ────────────────────────────────────────────────────────────────

const cardVariants = {
	hidden: { opacity: 0, y: 12 },
	visible: (i: number) => ({
		opacity: 1,
		transition: { delay: i * 0.07, duration: 0.3, ease: "easeOut" as const },
		y: 0,
	}),
};

const DEFAULT_SORT: SortStateType = { dir: "desc", field: "created_at" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: string): string {
	return new Date(date).toLocaleDateString("en-IN", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ClientsPage = () => {
	const dispatch = useAppDispatch();
	const clients = useAppSelector(selectClients);

	// ── Client dialog state ──────────────────────────────────────────────────
	const [activateClient, setActivateClient] = useState<ClientType | null>(null);
	const [addOpen, setAddOpen] = useState(false);
	const [attachDbClient, setAttachDbClient] = useState<ClientType | null>(null);
	const [createAdminClient, setCreateAdminClient] = useState<ClientType | null>(null);
	const [deactivateClient, setDeactivateClient] = useState<ClientType | null>(null);
	const [deleteClient, setDeleteClient] = useState<ClientType | null>(null);
	const [detachDbClient, setDetachDbClient] = useState<ClientType | null>(null);
	const [editClient, setEditClient] = useState<ClientType | null>(null);
	const [initializeClient, setInitializeClient] = useState<ClientType | null>(null);
	const [orphanDbsOpen, setOrphanDbsOpen] = useState(false);
	const [viewClient, setViewClient] = useState<ClientType | null>(null);

	// ── Admin dialog state ───────────────────────────────────────────────────
	const [activateAdmin, setActivateAdmin] = useState<{ admin: ClientAdminType; client: ClientType } | null>(null);
	const [deactivateAdmin, setDeactivateAdmin] = useState<{ admin: ClientAdminType; client: ClientType } | null>(null);
	const [editAdmin, setEditAdmin] = useState<{ admin: ClientAdminType; client: ClientType } | null>(null);
	const [mailAdminCredentials, setMailAdminCredentials] = useState<{ admin: ClientAdminType; client: ClientType } | null>(null);

	// ── UI state ─────────────────────────────────────────────────────────────
	const [expanded, setExpanded] = useState<Record<number, boolean>>({});
	const [search, setSearch] = useState("");
	const [sort, setSort] = useState<SortStateType>(DEFAULT_SORT);

	const { data, error, loading, refetch } = useQuery<ClientsPageDataType>(
		GRAPHQL_MAP.superAdminClientsData,
		{ notifyOnNetworkStatusChange: true },
	);

	const clientStats = data?.superAdminClientsData;

	useEffect(() => {
		if (clientStats?.clients) {
			dispatch(setClients(clientStats.clients));
		}
	}, [clientStats, dispatch]);

	useEffect(() => {
		if (error) toast.error(MESSAGES.ERROR_CLIENTS_LOAD);
	}, [error]);

	const displayList = useMemo(() => {
		const sorted = [...clients].sort((a, b) => {
			if (sort.field === "name") {
				const cmp = a.name.localeCompare(b.name);
				return sort.dir === "asc" ? cmp : -cmp;
			}
			const cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
			return sort.dir === "asc" ? cmp : -cmp;
		});
		const q = search.toLowerCase();
		return sorted.filter(
			(c) =>
				c.name.toLowerCase().includes(q) ||
				c.code.toLowerCase().includes(q) ||
				c.admins?.some(
					(a) =>
						a.full_name.toLowerCase().includes(q) ||
						a.email.toLowerCase().includes(q),
				),
		);
	}, [clients, search, sort]);

	// ── Client handlers ──────────────────────────────────────────────────────
	const handleActivate    = (client: ClientType) => setActivateClient(client);
	const handleAddClient   = () => setAddOpen(true);
	const handleAttachDb    = (client: ClientType) => setAttachDbClient(client);
	const handleCreateAdmin = (client: ClientType) => setCreateAdminClient(client);
	const handleDeactivate  = (client: ClientType) => setDeactivateClient(client);
	const handleDelete      = (client: ClientType) => setDeleteClient(client);
	const handleDetachDb    = (client: ClientType) => setDetachDbClient(client);
	const handleEdit        = (client: ClientType) => setEditClient(client);
	const handleView        = (client: ClientType) => setViewClient(client);

	function handleInitialize(client: ClientType) {
		setInitializeClient(client);
	}

	async function handleRefetch() {
		const result = await refetch();
		if (result.data?.superAdminClientsData?.clients) {
			dispatch(setClients(result.data.superAdminClientsData.clients));
		}
	}

	// ── Admin handlers ───────────────────────────────────────────────────────
	const handleActivateAdmin       = (admin: ClientAdminType, client: ClientType) => setActivateAdmin({ admin, client });
	const handleDeactivateAdmin     = (admin: ClientAdminType, client: ClientType) => setDeactivateAdmin({ admin, client });
	const handleEditAdmin           = (admin: ClientAdminType, client: ClientType) => setEditAdmin({ admin, client });
	const handleMailAdminCredentials = (admin: ClientAdminType, client: ClientType) => setMailAdminCredentials({ admin, client });

	// ── Sort + expand ────────────────────────────────────────────────────────
	function handleNameSort() {
		setSort((prev) => {
			if (prev.field !== "name") return { dir: "asc", field: "name" };
			if (prev.dir === "asc") return { dir: "desc", field: "name" };
			return DEFAULT_SORT;
		});
	}

	function toggleExpanded(clientId: number) {
		setExpanded((prev) => ({ ...prev, [clientId]: !prev[clientId] }));
	}

	const nameSortIcon =
		sort.field !== "name" ? (
			<ArrowUpDownIcon className="ml-1 h-3 w-3 text-slate-400" />
		) : sort.dir === "asc" ? (
			<ArrowUpIcon className="ml-1 h-3 w-3 text-emerald-500" />
		) : (
			<ArrowDownIcon className="ml-1 h-3 w-3 text-emerald-500" />
		);

	// ── Stat cards ───────────────────────────────────────────────────────────
	const statCards = [
		{
			accent: "text-slate-700",
			active: { accent: "text-emerald-600", icon: CheckCircle2Icon, iconBg: "bg-emerald-100", label: "Active", value: clientStats?.activeClients ?? 0 },
			custom: 0,
			icon: UsersIcon,
			iconBg: "bg-slate-100",
			inactive: { accent: "text-slate-400", icon: MinusCircleIcon, iconBg: "bg-slate-100", label: "Inactive", value: clientStats?.inactiveClients ?? 0 },
			label: "Clients",
			total: { accent: "text-slate-700", icon: UsersIcon, iconBg: "bg-slate-100", label: "Total", value: clientStats?.totalClients ?? 0 },
		},
		{
			accent: "text-violet-600",
			active: { accent: "text-teal-600", icon: CheckCircle2Icon, iconBg: "bg-teal-100", label: "Active", value: clientStats?.activeAdmins ?? 0 },
			custom: 1,
			icon: ShieldIcon,
			iconBg: "bg-violet-100",
			inactive: { accent: "text-slate-400", icon: MinusCircleIcon, iconBg: "bg-slate-100", label: "Inactive", value: clientStats?.inactiveAdmins ?? 0 },
			label: "Admins",
			total: { accent: "text-violet-600", icon: ShieldIcon, iconBg: "bg-violet-100", label: "Total", value: clientStats?.totalAdmins ?? 0 },
		},
	];

	return (
		<SuperAdminLayout>
			<div className="relative">
				{loading && <PageLoader message={MESSAGES.LOADING_CLIENTS} />}
			<motion.div
				animate={{ opacity: 1 }}
				className="flex flex-col gap-6"
				initial={{ opacity: 0 }}
				transition={{ duration: 0.25 }}
			>
				{/* Page header */}
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-xl font-bold text-slate-900">All Clients</h1>
						<p className="mt-1 text-sm text-slate-500">Manage all clients and their administrators.</p>
					</div>
					<div className="flex items-center gap-2">
						<Button
							className="gap-1.5 border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900"
							disabled={loading}
							size="sm"
							variant="outline"
							onClick={() => refetch()}
						>
							<RefreshCwIcon className="h-3.5 w-3.5" />
							Refresh
						</Button>
						<Button
							className="bg-emerald-600 text-white hover:bg-emerald-700"
							size="sm"
							onClick={handleAddClient}
						>
							<PlusIcon className="mr-1.5 h-3.5 w-3.5" />
							Add Client
						</Button>
					</div>
				</div>

				{/* Stat cards — Clients | Admins | Orphan DBs */}
				{loading && clients.length === 0 ? (
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
						{Array.from({ length: 3 }).map((_, i) => (
							<div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />
						))}
					</div>
				) : (
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
						{statCards.map((card) => {
							const Icon         = card.icon;
							const TotalIcon    = card.total.icon;
							const ActiveIcon   = card.active.icon;
							const InactiveIcon = card.inactive.icon;
							return (
								<motion.div animate="visible" className="h-full" custom={card.custom} initial="hidden" key={card.label} variants={cardVariants}>
									<Card className="flex h-full flex-col border border-slate-200/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
										<CardContent className="p-3">
											{/* Card header */}
											<div className="mb-3 flex items-center gap-1.5">
												<div className={`flex h-5 w-5 items-center justify-center rounded ${card.iconBg}`}>
													<Icon className={`h-3 w-3 ${card.accent}`} />
												</div>
												<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
											</div>
											{/* Three rows: total / active / inactive */}
											<div className="flex flex-col gap-1">
												<div className="flex items-center justify-between">
													<div className="flex items-center gap-1.5">
														<div className={`flex h-4 w-4 items-center justify-center rounded ${card.total.iconBg}`}>
															<TotalIcon className={`h-2.5 w-2.5 ${card.total.accent}`} />
														</div>
														<span className="text-[11px] text-slate-500">Total</span>
													</div>
													<span className={`text-base font-bold ${card.total.accent}`}>{card.total.value}</span>
												</div>
												<div className="flex items-center justify-between">
													<div className="flex items-center gap-1.5">
														<div className={`flex h-4 w-4 items-center justify-center rounded ${card.active.iconBg}`}>
															<ActiveIcon className={`h-2.5 w-2.5 ${card.active.accent}`} />
														</div>
														<span className="text-[11px] text-slate-500">Active</span>
													</div>
													<span className={`text-base font-bold ${card.active.accent}`}>{card.active.value}</span>
												</div>
												<div className="flex items-center justify-between">
													<div className="flex items-center gap-1.5">
														<div className={`flex h-4 w-4 items-center justify-center rounded ${card.inactive.iconBg}`}>
															<InactiveIcon className={`h-2.5 w-2.5 ${card.inactive.accent}`} />
														</div>
														<span className="text-[11px] text-slate-500">Inactive</span>
													</div>
													<span className={`text-base font-bold ${card.inactive.accent}`}>{card.inactive.value}</span>
												</div>
											</div>
										</CardContent>
									</Card>
								</motion.div>
							);
						})}

						{/* Orphan DBs */}
						<motion.div animate="visible" className="h-full" custom={2} initial="hidden" variants={cardVariants}>
							<Card className="flex h-full flex-col border border-orange-200/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
								<CardContent className="p-3">
									{/* Card header */}
									<div className="mb-3 flex items-center gap-1.5">
										<div className="flex h-5 w-5 items-center justify-center rounded bg-orange-100">
											<ServerCrashIcon className="h-3 w-3 text-orange-600" />
										</div>
										<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Orphan DBs</p>
									</div>
									<div className="flex items-center justify-between">
										<span className="text-base font-bold text-orange-600">{clientStats?.orphanDatabaseCount ?? 0} <span className="text-[11px] font-normal text-slate-500">unlinked</span></span>
										<Button
											className="h-6 border-orange-200 bg-orange-50 px-2 text-[10px] text-orange-700 hover:bg-orange-100"
											size="sm"
											variant="outline"
											onClick={() => setOrphanDbsOpen(true)}
										>
											View
										</Button>
									</div>
								</CardContent>
							</Card>
						</motion.div>
					</div>
				)}

				{/* Section title */}
				<h2 className="text-sm font-semibold text-slate-700">All Clients</h2>

				{/* Search + sort */}
				<div className="flex items-center gap-2">
					<div className="relative">
						<SearchIcon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
						<Input
							className="w-64 pl-8 text-sm"
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search clients or admins…"
							value={search}
						/>
					</div>
					<Button
						className="h-9 gap-1 border border-slate-200 bg-white text-xs text-slate-600 hover:bg-slate-50"
						size="sm"
						variant="outline"
						onClick={handleNameSort}
					>
						Name {nameSortIcon}
					</Button>
				</div>
				{/* Accordion client list */}
				{loading && clients.length === 0 ? (
					<div className="flex flex-col gap-3">
						{Array.from({ length: 3 }).map((_, i) => (
							<div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
						))}
					</div>
				) : displayList.length === 0 ? (
					<div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-400 shadow-sm">
						{search ? "No clients match your search." : "No clients found."}
					</div>
				) : (
					<div className="flex flex-col gap-3">
						{displayList.map((client, idx) => {
							const isOpen = expanded[client.id] ?? false;
							const canAddAdmin = !!(client.db_name && client.db_name_valid && client.is_active);
							const canInitialize = client.is_active && (!client.db_name || (client.db_name_valid && client.activeAdminCount === 0));

							return (
								<motion.div
									animate={{ opacity: 1, y: 0 }}
									initial={{ opacity: 0, y: 8 }}
									key={client.id}
									transition={{ delay: idx * 0.04, duration: 0.25, ease: "easeOut" }}
								>
									<Card className={`overflow-hidden bg-white shadow-sm transition-shadow hover:shadow-md ${client.is_active ? "border border-slate-200" : "border border-l-4 border-slate-200 border-l-red-400"}`}>
										{/* Card header */}
										<div className={`flex items-center gap-3 px-4 py-3.5 ${!client.is_active ? "bg-red-50/20" : ""}`}>
											{/* Index */}
											<span className="w-5 flex-shrink-0 text-center text-[11px] font-medium text-slate-300">{idx + 1}</span>

											{/* Avatar */}
											<div className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-base font-bold shadow-sm ${client.is_active ? "bg-gradient-to-br from-emerald-400 to-teal-500 text-white" : "bg-gradient-to-br from-slate-300 to-slate-400 text-white"}`}>
												{client.name.charAt(0).toUpperCase()}
												{!client.is_active && (
													<BanIcon className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-white text-red-400" />
												)}
											</div>

											{/* Clickable content area */}
											<button
												className="flex min-w-0 flex-1 cursor-pointer flex-col text-left focus:outline-none"
												type="button"
												onClick={() => toggleExpanded(client.id)}
											>
												{/* Row 1: name + code + status + db icon */}
												<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
													<span className={`text-sm font-semibold ${client.is_active ? "text-slate-900" : "text-slate-400 line-through decoration-slate-300"}`}>
														{client.name}
													</span>
													<span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
														{client.code}
													</span>
													<Badge
														className={
															client.is_active
																? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
																: "border-red-200 bg-red-50 text-red-500 hover:bg-red-50"
														}
														variant="outline"
													>
														<span className={`mr-1 h-1.5 w-1.5 rounded-full ${client.is_active ? "bg-emerald-500" : "bg-red-400"}`} />
														{client.is_active ? "Active" : "Inactive"}
													</Badge>
													{client.db_name && (
														client.db_name_valid
															? <span title="Database ready"><DatabaseIcon className="h-3.5 w-3.5 text-emerald-500" /></span>
															: <span title="Database not found"><XCircleIcon className="h-3.5 w-3.5 text-red-400" /></span>
													)}
												</div>
												{/* Row 2: meta chips */}
												<div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
													<span className="inline-flex items-center gap-1 text-[11px]">
														<ShieldIcon className="h-3 w-3 text-slate-300" />
														<span className="font-medium text-teal-600">{client.activeAdminCount}</span>
														<span className="text-slate-400">active</span>
														{client.inactiveAdminCount > 0 && (
															<>
																<span className="text-slate-300">&middot;</span>
																<span className="font-medium text-red-500">{client.inactiveAdminCount}</span>
																<span className="text-slate-400">inactive</span>
															</>
														)}
														<span className="text-slate-400">admins</span>
													</span>
													<span className="inline-flex items-center gap-1 text-[11px]">
														<BuildingIcon className="h-3 w-3 text-slate-400" />
														<span className="font-medium text-emerald-600">{client.activeBuCount}</span>
														<span className="text-slate-400">active</span>
														{client.inactiveBuCount > 0 && (
															<>
																<span className="text-slate-300">&middot;</span>
																<span className="font-medium text-red-500">{client.inactiveBuCount}</span>
																<span className="text-slate-400">inactive</span>
															</>
														)}
														<span className="text-slate-400">BUs</span>
													</span>
													{client.db_name && (
														<span className="hidden items-center gap-1 lg:inline-flex">
															<DatabaseIcon className="h-3 w-3 text-slate-400" />
															<span className="font-mono text-[11px] text-slate-400">{client.db_name}</span>
														</span>
													)}
													<span className="hidden text-[11px] text-slate-500 lg:inline">&middot; {formatDate(client.created_at)}</span>
													<span className="hidden text-[11px] text-slate-500 lg:inline">&middot; upd. {formatDate(client.updated_at)}</span>
													<span className="text-[10px] italic text-slate-400">
														{isOpen ? "Click to hide admins" : "Click to show admins"}
													</span>
												</div>
											</button>

											{/* Chevron */}
											<button
												className="flex-shrink-0 cursor-pointer rounded-md p-1 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none"
												type="button"
												onClick={() => toggleExpanded(client.id)}
											>
												<motion.div animate={{ rotate: isOpen ? 90 : 0 }} transition={{ duration: 0.2 }}>
													<ChevronRightIcon className="h-4 w-4" />
												</motion.div>
											</button>

											{/* Action buttons */}
											<div
												className="flex flex-shrink-0 items-center gap-1"
												onClick={(e) => e.stopPropagation()}
											>
												<Button
													className="h-7 border-amber-200 bg-amber-50 px-2 text-xs text-amber-700 hover:bg-amber-100 hover:text-amber-800 disabled:opacity-40"
													disabled={!canInitialize}
													size="sm"
													variant="outline"
													onClick={() => handleInitialize(client)}
												>
													Initialize
												</Button>
												<DropdownMenu>
													<DropdownMenuTrigger asChild>
														<Button className="h-7 w-7 cursor-pointer text-slate-400 hover:text-slate-700" size="icon" variant="ghost">
															<MoreHorizontalIcon className="h-4 w-4" />
															<span className="sr-only">Actions</span>
														</Button>
													</DropdownMenuTrigger>
													<DropdownMenuContent align="end" className="w-36">
														<DropdownMenuItem
															className="cursor-pointer text-emerald-600 focus:text-emerald-600"
															disabled={!canAddAdmin}
															onClick={() => handleCreateAdmin(client)}
														>
															Add Admin
														</DropdownMenuItem>
														<DropdownMenuSeparator />
														<DropdownMenuItem className="cursor-pointer" onClick={() => handleView(client)}>View</DropdownMenuItem>
														<DropdownMenuItem className="cursor-pointer" onClick={() => handleEdit(client)}>Edit</DropdownMenuItem>
														<DropdownMenuItem
															className="cursor-pointer text-blue-600 focus:text-blue-600"
															disabled={!!client.db_name}
															onClick={() => handleAttachDb(client)}
														>
															Attach DB
														</DropdownMenuItem>
														<DropdownMenuItem
															className="cursor-pointer text-orange-600 focus:text-orange-600"
															disabled={!client.db_name || client.is_active}
															onClick={() => handleDetachDb(client)}
														>
															Detach DB
														</DropdownMenuItem>
														<DropdownMenuSeparator />
														{client.is_active ? (
															<DropdownMenuItem
																className="cursor-pointer text-amber-600 focus:text-amber-600"
																onClick={() => handleDeactivate(client)}
															>
																Deactivate
															</DropdownMenuItem>
														) : (
															<>
																<DropdownMenuItem
																	className="cursor-pointer text-emerald-600 focus:text-emerald-600"
																	onClick={() => handleActivate(client)}
																>
																	Activate
																</DropdownMenuItem>
																<DropdownMenuSeparator />
																<DropdownMenuItem
																	className="cursor-pointer text-red-600 focus:text-red-600"
																	onClick={() => handleDelete(client)}
																>
																	Delete
																</DropdownMenuItem>
															</>
														)}
													</DropdownMenuContent>
												</DropdownMenu>
											</div>
										</div>

										{/* Admin sub-table */}
										{isOpen && (
											<div className="border-t border-slate-100">
												<p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
													Admins for {client.name}
												</p>
												{!client.db_name || !client.db_name_valid ? (
													<p className="px-5 py-4 text-sm text-slate-400">Database not initialized.</p>
												) : !client.admins?.length ? (
													<p className="px-5 py-4 text-sm text-slate-400">No admin users yet.</p>
												) : (
													<div className="overflow-x-auto">
														<Table>
															<TableHeader>
																<TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
																	<TableHead className="w-8 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">#</TableHead>
																	<TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Full Name</TableHead>
																	<TableHead className="hidden text-xs font-semibold uppercase tracking-wide text-slate-500 sm:table-cell">Email</TableHead>
																	<TableHead className="hidden text-xs font-semibold uppercase tracking-wide text-slate-500 md:table-cell">Mobile</TableHead>
																	<TableHead className="hidden text-xs font-semibold uppercase tracking-wide text-slate-500 lg:table-cell">Updated At</TableHead>
																	<TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</TableHead>
																	<TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</TableHead>
																</TableRow>
															</TableHeader>
															<TableBody>
																{client.admins.map((admin, aIdx) => (
																	<TableRow
																		className={`transition-colors ${admin.is_active ? `hover:bg-emerald-50/40 ${aIdx % 2 === 0 ? "bg-white" : "bg-slate-50/30"}` : "border-l-2 border-l-red-300 bg-red-50/40 hover:bg-red-50/60"}`}
																		key={admin.id}
																	>
																		<TableCell className="text-center text-xs text-slate-400">{aIdx + 1}</TableCell>
																		<TableCell className="font-medium text-slate-900">
																			<div className="flex items-center gap-2">
																				<div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${admin.is_active ? "bg-cyan-100 text-cyan-700" : "bg-slate-200 text-slate-400"}`}>
																					{admin.full_name.charAt(0).toUpperCase()}
																				</div>
																				<div>
																					<div className={`text-sm ${admin.is_active ? "" : "text-slate-400 line-through decoration-slate-300"}`}>{admin.full_name}</div>
																					<div className="mt-0.5 text-xs text-slate-400 sm:hidden">{admin.email}</div>
																				</div>
																			</div>
																		</TableCell>
																		<TableCell className={`hidden text-sm sm:table-cell ${admin.is_active ? "text-slate-600" : "text-slate-400"}`}>{admin.email}</TableCell>
																		<TableCell className={`hidden text-sm md:table-cell ${admin.is_active ? "text-slate-500" : "text-slate-400"}`}>{admin.mobile ?? "—"}</TableCell>
																		<TableCell className={`hidden text-xs lg:table-cell ${admin.is_active ? "text-slate-500" : "text-slate-400"}`}>{formatDate(admin.updated_at)}</TableCell>
																		<TableCell>
																			<Badge
																				className={
																					admin.is_active
																						? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
																						: "border-red-200 bg-red-100 text-red-500 hover:bg-red-100"
																				}
																				variant="outline"
																			>
																				{admin.is_active ? "Active" : "Inactive"}
																			</Badge>
																		</TableCell>
																		<TableCell>
																			<DropdownMenu>
																				<DropdownMenuTrigger asChild>
																					<Button className="h-7 w-7 cursor-pointer text-slate-400 hover:text-slate-700" size="icon" variant="ghost">
																						<MoreHorizontalIcon className="h-4 w-4" />
																						<span className="sr-only">Actions</span>
																					</Button>
																				</DropdownMenuTrigger>
																				<DropdownMenuContent align="end" className="w-52">
																					<DropdownMenuItem
																						className="cursor-pointer"
																						disabled={!admin.is_active}
																						onClick={() => handleEditAdmin(admin, client)}
																					>
																						Edit
																					</DropdownMenuItem>
																					<DropdownMenuItem
																						className="cursor-pointer text-blue-600 focus:text-blue-600"
																						disabled={!admin.is_active}
																						onClick={() => handleMailAdminCredentials(admin, client)}
																					>
																						Reset password and mail
																					</DropdownMenuItem>
																					<DropdownMenuSeparator />
																					{admin.is_active ? (
																						<DropdownMenuItem
																							className="cursor-pointer text-amber-600 focus:text-amber-600"
																							onClick={() => handleDeactivateAdmin(admin, client)}
																						>
																							Deactivate
																						</DropdownMenuItem>
																					) : (
																						<DropdownMenuItem
																							className="cursor-pointer text-emerald-600 focus:text-emerald-600"
																							onClick={() => handleActivateAdmin(admin, client)}
																						>
																							Activate
																						</DropdownMenuItem>
																					)}
																				</DropdownMenuContent>
																			</DropdownMenu>
																		</TableCell>
																	</TableRow>
																))}
															</TableBody>
														</Table>
													</div>
												)}
											</div>
										)}
									</Card>
								</motion.div>
							);
						})}
					</div>
				)}
			</motion.div>
			</div>

			{/* ── Client dialogs ─────────────────────────────────────────────── */}
			<AddClientDialog open={addOpen} onOpenChange={setAddOpen} onSuccess={handleRefetch} />
			{createAdminClient && (
				<CreateAdminDialog
					client={createAdminClient}
					open={!!createAdminClient}
					onOpenChange={(open) => { if (!open) setCreateAdminClient(null); }}
					onSuccess={handleRefetch}
				/>
			)}
			{initializeClient && (
				<InitializeClientDialog
					client={initializeClient}
					open={!!initializeClient}
					onOpenChange={(open) => { if (!open) setInitializeClient(null); }}
					onStep1Success={handleRefetch}
					onSuccess={handleRefetch}
				/>
			)}
			<ViewClientDialog
				client={viewClient}
				open={!!viewClient}
				onOpenChange={(open) => { if (!open) setViewClient(null); }}
			/>
			<EditClientDialog
				client={editClient}
				open={!!editClient}
				onOpenChange={(open) => { if (!open) setEditClient(null); }}
				onSuccess={handleRefetch}
			/>
			<AttachDbDialog
				client={attachDbClient}
				open={!!attachDbClient}
				onOpenChange={(open) => { if (!open) setAttachDbClient(null); }}
				onSuccess={handleRefetch}
			/>
			<DeleteClientDialog
				client={deleteClient}
				open={!!deleteClient}
				onOpenChange={(open) => { if (!open) setDeleteClient(null); }}
				onSuccess={handleRefetch}
			/>
			<DetachDbDialog
				client={detachDbClient}
				open={!!detachDbClient}
				onOpenChange={(open) => { if (!open) setDetachDbClient(null); }}
				onSuccess={handleRefetch}
			/>
			<DeactivateClientDialog
				client={deactivateClient}
				open={!!deactivateClient}
				onOpenChange={(open) => { if (!open) setDeactivateClient(null); }}
				onSuccess={handleRefetch}
			/>
			<ActivateClientDialog
				client={activateClient}
				open={!!activateClient}
				onOpenChange={(open) => { if (!open) setActivateClient(null); }}
				onSuccess={handleRefetch}
			/>
			<OrphanDatabasesDialog
				databases={clientStats?.orphanDatabases ?? []}
				open={orphanDbsOpen}
				onOpenChange={setOrphanDbsOpen}
				onSuccess={handleRefetch}
			/>

			{/* ── Admin dialogs ──────────────────────────────────────────────── */}
			{editAdmin && (
				<EditAdminDialog
					admin={editAdmin.admin}
					clientName={editAdmin.client.name}
					dbName={editAdmin.client.db_name!}
					open={!!editAdmin}
					onOpenChange={(open) => { if (!open) setEditAdmin(null); }}
					onSuccess={handleRefetch}
				/>
			)}
			{activateAdmin && (
				<ActivateAdminDialog
					admin={activateAdmin.admin}
					clientName={activateAdmin.client.name}
					dbName={activateAdmin.client.db_name!}
					open={!!activateAdmin}
					onOpenChange={(open) => { if (!open) setActivateAdmin(null); }}
					onSuccess={handleRefetch}
				/>
			)}
			{deactivateAdmin && (
				<DeactivateAdminDialog
					admin={deactivateAdmin.admin}
					clientName={deactivateAdmin.client.name}
					dbName={deactivateAdmin.client.db_name!}
					open={!!deactivateAdmin}
					onOpenChange={(open) => { if (!open) setDeactivateAdmin(null); }}
					onSuccess={handleRefetch}
				/>
			)}
		{mailAdminCredentials && (
				<MailAdminCredentialsDialog
					admin={mailAdminCredentials.admin}
					dbName={mailAdminCredentials.client.db_name!}
					open={!!mailAdminCredentials}
					onOpenChange={(open) => { if (!open) setMailAdminCredentials(null); }}
					onSuccess={handleRefetch}
				/>
			)}
		</SuperAdminLayout>
	);
};