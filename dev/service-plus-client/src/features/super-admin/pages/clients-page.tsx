import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
	ArrowDownIcon,
	ArrowUpDownIcon,
	ArrowUpIcon,
	CheckCircle2Icon,
	MinusCircleIcon,
	MoreHorizontalIcon,
	PlusIcon,
	RefreshCwIcon,
	SearchIcon,
	UsersIcon,
	XCircleIcon,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { useQuery } from "@apollo/client/react";
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

import { AddClientDialog } from "../components/add-client-dialog";
import { InitializeClientDialog } from "../components/initialize-client-dialog";
import { SuperAdminLayout } from "../components/super-admin-layout";
import { selectClients, setClients } from "@/features/super-admin/store/super-admin-slice";
import type { ClientType } from "@/features/super-admin/types";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";

type ClientsPageStatsType = {
	activeClients: number;
	inactiveClients: number;
	totalClients: number;
};

type ClientsPageDataType = {
	superAdminClientsData: ClientsPageStatsType & { clients: ClientType[] };
};

type SortDirType = "asc" | "desc";
type SortFieldType = "created_at" | "name";
type SortStateType = { dir: SortDirType; field: SortFieldType };

const cardVariants = {
	hidden: { opacity: 0, y: 12 },
	visible: (i: number) => ({
		opacity: 1,
		transition: { delay: i * 0.07, duration: 0.3, ease: "easeOut" as const },
		y: 0,
	}),
};

const DEFAULT_SORT: SortStateType = { dir: "desc", field: "created_at" };

function formatDate(date: string): string {
	return new Date(date).toLocaleDateString("en-IN", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
}

const handleEdit = (client: ClientType) => toast.info(`Editing ${client.name}`);
const handleView = (client: ClientType) => toast.info(`Viewing ${client.name}`);

export const ClientsPage = () => {
	const dispatch = useAppDispatch();
	const clients = useAppSelector(selectClients);
	const [addOpen, setAddOpen] = useState(false);
	const [initializeClient, setInitializeClient] = useState<ClientType | null>(null);
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
		if (error) {
			toast.error(MESSAGES.ERROR_CLIENTS_LOAD);
		}
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
			(c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
		);
	}, [clients, search, sort]);

	const handleAddClient = () => setAddOpen(true);

	function handleInitialize(client: ClientType) {
		setInitializeClient(client);
	}

	const handleDisable = (client: ClientType) => {
		toast.success(`${client.name} has been disabled`);
	};

	function handleNameSort() {
		setSort((prev) => {
			if (prev.field !== "name") return { dir: "asc", field: "name" };
			if (prev.dir === "asc") return { dir: "desc", field: "name" };
			return DEFAULT_SORT;
		});
	}

	const nameSortIcon =
		sort.field !== "name" ? (
			<ArrowUpDownIcon className="ml-1 inline h-3 w-3 text-slate-400" />
		) : sort.dir === "asc" ? (
			<ArrowUpIcon className="ml-1 inline h-3 w-3 text-emerald-500" />
		) : (
			<ArrowDownIcon className="ml-1 inline h-3 w-3 text-emerald-500" />
		);

	const statCards = [
		{
			accent: "text-slate-700",
			icon: UsersIcon,
			iconBg: "bg-slate-100",
			label: "Total Clients",
			value: clientStats?.totalClients ?? 0,
		},
		{
			accent: "text-emerald-600",
			icon: CheckCircle2Icon,
			iconBg: "bg-emerald-100",
			label: "Active",
			value: clientStats?.activeClients ?? 0,
		},
		{
			accent: "text-slate-500",
			icon: MinusCircleIcon,
			iconBg: "bg-slate-100",
			label: "Inactive",
			value: clientStats?.inactiveClients ?? 0,
		},
	];

	return (
		<SuperAdminLayout>
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
							<motion.span
								animate={loading ? { rotate: 360 } : { rotate: 0 }}
								transition={loading ? { duration: 0.8, ease: "linear", repeat: Infinity } : { duration: 0 }}
							>
								<RefreshCwIcon className="h-3.5 w-3.5" />
							</motion.span>
							{loading ? "Refreshing..." : "Refresh"}
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

				{/* Stat cards */}
				{loading && clients.length === 0 ? (
					<div className="grid grid-cols-3 gap-4">
						{Array.from({ length: 3 }).map((_, i) => (
							<div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
						))}
					</div>
				) : (
					<div className="grid grid-cols-3 gap-4">
						{statCards.map((card, i) => {
							const Icon = card.icon;
							return (
								<motion.div animate="visible" custom={i} initial="hidden" key={card.label} variants={cardVariants}>
									<Card className="border border-slate-200/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
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
				)}

				{/* Client table */}
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
									<TableHead className="w-10 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">#</TableHead>
									<TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
										<button
											className="flex cursor-pointer items-center focus:outline-none"
											type="button"
											onClick={handleNameSort}
										>
											Client Name
											{nameSortIcon}
										</button>
									</TableHead>
									<TableHead className="hidden text-xs font-semibold uppercase tracking-wide text-slate-500 sm:table-cell">Code</TableHead>
									<TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</TableHead>
									<TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admins</TableHead>
									<TableHead className="hidden text-xs font-semibold uppercase tracking-wide text-slate-500 lg:table-cell">DB Name</TableHead>
									<TableHead className="hidden text-xs font-semibold uppercase tracking-wide text-slate-500 lg:table-cell">Created On</TableHead>
									<TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{loading && clients.length === 0 ? (
									Array.from({ length: 4 }).map((_, i) => (
										<TableRow key={i}>
											{Array.from({ length: 8 }).map((__, j) => (
												<TableCell key={j}>
													<div className="h-4 animate-pulse rounded bg-slate-100" />
												</TableCell>
											))}
										</TableRow>
									))
								) : displayList.length === 0 ? (
									<TableRow>
										<TableCell className="py-8 text-center text-sm text-slate-400" colSpan={8}>
											{search ? "No clients match your search." : "No clients found."}
										</TableCell>
									</TableRow>
								) : (
									displayList.map((client, index) => (
										<TableRow
											className={`transition-colors hover:bg-emerald-50/40 ${index % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}
											key={client.id}
										>
											<TableCell className="text-center text-xs font-medium text-slate-400">
												{index + 1}
											</TableCell>
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
											<TableCell className="hidden font-mono text-sm text-slate-600 sm:table-cell">{client.code}</TableCell>
											<TableCell>
												<Badge
													className={
														client.is_active
															? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
															: "border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-100"
													}
													variant="outline"
												>
													<span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${client.is_active ? "bg-emerald-500" : "bg-slate-400"}`} />
													{client.is_active ? "Active" : "Inactive"}
												</Badge>
											</TableCell>
											<TableCell>
												<div className="flex items-center gap-2">
													<span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600">
														<span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
														{client.activeAdminCount}
													</span>
													<span className="text-slate-300">/</span>
													<span className={`inline-flex items-center gap-1 text-xs font-semibold ${client.inactiveAdminCount > 0 ? "text-red-500" : "text-slate-400"}`}>
														<span className={`h-1.5 w-1.5 rounded-full ${client.inactiveAdminCount > 0 ? "bg-red-400" : "bg-slate-300"}`} />
														{client.inactiveAdminCount}
													</span>
												</div>
											</TableCell>
											<TableCell className="hidden lg:table-cell">
												<span className="inline-flex items-center gap-1 font-mono text-xs text-slate-500">
													{client.db_name ?? "—"}
													{client.db_name && client.db_name_valid && (
														<CheckCircle2Icon className="h-3.5 w-3.5 text-emerald-500" title="Database exists" />
													)}
													{client.db_name && !client.db_name_valid && (
														<XCircleIcon className="h-3.5 w-3.5 text-red-500" title="Database does not exist" />
													)}
												</span>
											</TableCell>
											<TableCell className="hidden text-sm text-slate-500 lg:table-cell">{formatDate(client.created_at)}</TableCell>
											<TableCell>
												<div className="flex items-center gap-1">
													<Button
														className="h-7 border-amber-200 bg-amber-50 px-2 text-xs text-amber-700 hover:bg-amber-100 hover:text-amber-800"
														disabled={!(!client.db_name || client.activeAdminCount === 0)}
														size="sm"
														variant="outline"
														onClick={() => handleInitialize(client)}
													>
														Initialize
													</Button>
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
												</div>
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>
				</motion.div>
			</motion.div>
			<AddClientDialog open={addOpen} onOpenChange={setAddOpen} onSuccess={refetch} />
			{initializeClient && (
				<InitializeClientDialog
					client={initializeClient}
					open={!!initializeClient}
					onOpenChange={(open) => { if (!open) setInitializeClient(null); }}
					onSuccess={refetch}
				/>
			)}
	</SuperAdminLayout>
	);
};
