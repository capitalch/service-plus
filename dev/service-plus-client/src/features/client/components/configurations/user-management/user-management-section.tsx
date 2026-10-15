import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { RefreshButton } from "@/components/shared/refresh-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useCanManageStaffUsers } from "@/components/shared/billing/use-can-manage-staff-users";
import { selectCurrentBu, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import { AddStaffUserDialog } from "./add-staff-user-dialog";
import type { StaffUserType } from "./staff-user";
import { useIsReadOnly } from "@/components/shared/billing/use-is-read-only";

type GenericQueryDataType = { genericQuery: StaffUserType[] | null };

const THEAD_CLASS = "text-xs font-semibold uppercase tracking-wide text-(--cl-text-muted)";

export const UserManagementSection = () => {
	const isReadOnly = useIsReadOnly();
	const canManage = useCanManageStaffUsers();
	const currentBu = useAppSelector(selectCurrentBu);
	const dbName = useAppSelector(selectDbName);
	const schema = useAppSelector(selectSchema);

	const [addOpen, setAddOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [users, setUsers] = useState<StaffUserType[]>([]);

	const loadData = useCallback(async () => {
		if (!dbName || !schema || !canManage) return;
		setLoading(true);
		try {
			const res = await apolloClient.query<GenericQueryDataType>({
				fetchPolicy: "network-only",
				query: GRAPHQL_MAP.genericQuery,
				variables: {
					db_name: dbName,
					schema,
					value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_STAFF_USERS }),
				},
			});
			setUsers(res.data?.genericQuery ?? []);
		} catch {
			toast.error(MESSAGES.ERROR_BUSINESS_USER_LOAD_FAILED);
		} finally {
			setLoading(false);
		}
	}, [canManage, dbName, schema]);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	// The sidebar hides the item for everyone else; this only stops a stale selection from rendering.
	if (!canManage) {
		return (
			<div className="flex items-center justify-center rounded-lg border border-(--cl-border) bg-(--cl-surface-2) p-20">
				<p className="text-sm text-(--cl-text-muted)">{MESSAGES.INFO_STAFF_USERS_UPGRADE}</p>
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
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h1 className="text-xl font-bold text-(--cl-text)">User Management</h1>
						<p className="mt-1 text-sm text-(--cl-text-muted)">{MESSAGES.INFO_STAFF_USERS_SUBTITLE}</p>
					</div>
					<div className="flex items-center gap-2">
						<RefreshButton loading={loading} onClick={loadData} />
						<Button
							className="gap-1.5 bg-teal-600 text-white hover:bg-teal-700"
							disabled={isReadOnly || !currentBu}
							onClick={() => setAddOpen(true)}
						>
							<Plus className="h-4 w-4" />
							Add User
						</Button>
					</div>
				</div>

				{loading && users.length === 0 ? (
					<div className="flex flex-col gap-2">
						{Array.from({ length: 4 }).map((_, i) => (
							<div key={i} className="h-12 animate-pulse rounded-lg bg-(--cl-surface-2)" />
						))}
					</div>
				) : users.length === 0 ? (
					<div className="rounded-xl border border-(--cl-border) bg-(--cl-surface-2) px-6 py-12 text-center text-sm text-(--cl-text-muted)">
						{MESSAGES.INFO_STAFF_USERS_EMPTY}
					</div>
				) : (
					<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-(--cl-border) bg-(--cl-surface-2) shadow-sm">
						<div className="overflow-x-auto overflow-y-auto">
							<Table>
								<TableHeader>
									<TableRow className="sticky top-0 z-10 bg-(--cl-surface-3) hover:bg-(--cl-surface-3)">
										<TableHead className={`w-8 text-center ${THEAD_CLASS}`}>#</TableHead>
										<TableHead className={THEAD_CLASS}>Name</TableHead>
										<TableHead className={THEAD_CLASS}>Username</TableHead>
										<TableHead className={THEAD_CLASS}>Role</TableHead>
										<TableHead className={THEAD_CLASS}>Email</TableHead>
										<TableHead className={THEAD_CLASS}>Mobile</TableHead>
										<TableHead className={THEAD_CLASS}>Status</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{users.map((u, idx) => (
										<TableRow key={u.id} className="border-b border-(--cl-border) last:border-b-0">
											<TableCell className="text-center text-xs text-(--cl-text-muted)">
												{idx + 1}
											</TableCell>
											<TableCell className="text-sm font-medium text-(--cl-text)">
												{u.full_name}
											</TableCell>
											<TableCell className="font-mono text-sm text-(--cl-text-muted)">
												{u.username}
											</TableCell>
											<TableCell className="text-sm text-(--cl-text-muted)">
												{u.role_name}
											</TableCell>
											<TableCell className="text-sm text-(--cl-text-muted)">{u.email}</TableCell>
											<TableCell className="text-sm text-(--cl-text-muted)">
												{u.mobile ?? "—"}
											</TableCell>
											<TableCell>
												{u.is_active ? (
													<Badge
														className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
														variant="outline"
													>
														Active
													</Badge>
												) : (
													<Badge
														className="border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-100"
														variant="outline"
													>
														Inactive
													</Badge>
												)}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					</div>
				)}
			</motion.div>

			<AddStaffUserDialog open={addOpen} onOpenChange={setAddOpen} onSuccess={() => void loadData()} />
		</>
	);
};
