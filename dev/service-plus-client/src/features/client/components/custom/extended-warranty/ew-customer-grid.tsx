import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { SEARCH_DEBOUNCE_MS } from "@/constants/timing";
import { selectDbName } from "@/features/auth/store/auth-slice";
import type { EwCustomerType } from "@/features/client/types/extended-warranty";
import { useDebounce } from "@/hooks/use-debounce";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

import { ReportEmpty } from "../../reports/common/report-empty";
import { ReportError } from "../../reports/common/report-error";
import { ReportLoading } from "../../reports/common/report-loading";
import { useGenericQuery } from "../../reports/common/use-generic-query";
import { EW_OUTCOME_LABEL, daysLeftLabel, formatDate } from "./extended-warranty-helpers";
import { EwCustomerDialog } from "./ew-customer-dialog";

const PAGE_SIZE = 50;

type Props = { onChanged: () => void };

export const EwCustomerGrid = ({ onChanged }: Props) => {
	const branch = useAppSelector(selectCurrentBranch);
	const dbName = useAppSelector(selectDbName);
	const schema = useAppSelector(selectSchema);

	const [search, setSearch] = useState("");
	const [page, setPage] = useState(0);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editing, setEditing] = useState<EwCustomerType | null>(null);
	const [deleting, setDeleting] = useState<EwCustomerType | null>(null);

	const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS);

	const { data, error, loading, refetch } = useGenericQuery<EwCustomerType & { total_count: number }>({
		enabled: !!branch?.id,
		sqlArgs: {
			branch_id: branch?.id ?? null,
			limit: PAGE_SIZE,
			offset: page * PAGE_SIZE,
			outcome: null,
			search: debouncedSearch || null,
			show_inactive: false,
		},
		sqlId: SQL_MAP.GET_EW_CUSTOMERS_PAGED,
	});

	async function handleDelete() {
		if (!deleting || !dbName || !schema) return;
		try {
			await apolloClient.mutate({
				mutation: GRAPHQL_MAP.genericUpdate,
				variables: {
					db_name: dbName,
					schema,
					value: graphQlUtils.buildGenericUpdateValue({
						deletedIds: [deleting.id],
						tableName: "ew_customer",
						xData: {},
					}),
				},
			});
			toast.success("Warranty record deleted.");
			setDeleting(null);
			refetch();
			onChanged();
		} catch {
			toast.error(MESSAGES.ERROR_EW_CUSTOMERS_LOAD_FAILED);
		}
	}

	const total = data[0]?.total_count ?? data.length;

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<Input
					className="max-w-xs"
					onChange={(e) => {
						setSearch(e.target.value);
						setPage(0);
					}}
					placeholder="Search name, mobile or serial no"
					value={search}
				/>
				<Button
					onClick={() => {
						setEditing(null);
						setDialogOpen(true);
					}}
					size="sm"
				>
					<Plus className="mr-1.5 size-3.5" />
					Add record
				</Button>
			</div>

			{loading && <ReportLoading />}
			{error && <ReportError message={MESSAGES.ERROR_EW_CUSTOMERS_LOAD_FAILED} onRetry={refetch} />}
			{!loading && !error && data.length === 0 && <ReportEmpty />}

			{!loading && !error && data.length > 0 && (
				<div className="min-h-0 flex-1 overflow-auto rounded-lg border border-(--cl-border)">
					<table className="w-full min-w-[960px] text-sm">
						<thead className="sticky top-0 bg-(--cl-surface-2)">
							<tr className="text-left text-xs font-bold tracking-tight text-(--cl-text)">
								<th className="px-3 py-2">Customer</th>
								<th className="px-3 py-2">Mobile</th>
								<th className="px-3 py-2">Brand</th>
								<th className="px-3 py-2">Model / product</th>
								<th className="px-3 py-2">Warranty ends</th>
								<th className="px-3 py-2">Days left</th>
								<th className="px-3 py-2">Outcome</th>
								<th className="px-3 py-2" />
							</tr>
						</thead>
						<tbody>
							{data.map((row) => (
								<tr key={row.id} className="border-t border-(--cl-border) hover:bg-(--cl-hover)">
									<td className="px-3 py-2 font-medium text-(--cl-text)">
										{row.full_name}
										{row.is_opted_out && (
											<span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
												opted out
											</span>
										)}
									</td>
									<td className="px-3 py-2 text-(--cl-text-muted)">{row.mobile}</td>
									<td className="px-3 py-2 text-(--cl-text-muted)">{row.brand_name ?? "-"}</td>
									<td className="px-3 py-2 text-(--cl-text-muted)">
										{row.model_name || row.product_name || "-"}
									</td>
									<td className="px-3 py-2 text-(--cl-text-muted)">
										{formatDate(row.warranty_end_date)}
									</td>
									<td className="px-3 py-2 text-(--cl-text-muted)">{daysLeftLabel(row.days_left)}</td>
									<td className="px-3 py-2 text-(--cl-text-muted)">
										{EW_OUTCOME_LABEL[row.outcome]}
									</td>
									<td className="px-3 py-2 text-right">
										<Button
											onClick={() => {
												setEditing(row);
												setDialogOpen(true);
											}}
											size="sm"
											variant="ghost"
										>
											<Pencil className="size-3.5" />
										</Button>
										<Button onClick={() => setDeleting(row)} size="sm" variant="ghost">
											<Trash2 className="size-3.5" />
										</Button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{total > PAGE_SIZE && (
				<div className="flex items-center justify-end gap-2 text-xs text-(--cl-text-muted)">
					<span>
						{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
					</span>
					<Button disabled={page === 0} onClick={() => setPage((p) => p - 1)} size="sm" variant="outline">
						Previous
					</Button>
					<Button
						disabled={(page + 1) * PAGE_SIZE >= total}
						onClick={() => setPage((p) => p + 1)}
						size="sm"
						variant="outline"
					>
						Next
					</Button>
				</div>
			)}

			<EwCustomerDialog
				editing={editing}
				onOpenChange={setDialogOpen}
				onSuccess={() => {
					refetch();
					onChanged();
				}}
				open={dialogOpen}
			/>

			<AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{MESSAGES.CONFIRM_EW_DELETE_TITLE}</AlertDialogTitle>
						<AlertDialogDescription>{MESSAGES.CONFIRM_EW_DELETE_BODY}</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
};
