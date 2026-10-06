import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Lock, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useIsReadOnly } from "@/components/shared/billing/use-is-read-only";
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
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { selectCurrentUser, selectDbName } from "@/features/auth/store/auth-slice";
import { ACCESS_RIGHTS, hasAccessRight } from "@/features/auth/utils/access-rights";
import { formatDateTime } from "@/features/client/components/shared/format-date-time";
import type { JobInternalNoteType } from "@/features/client/types/job";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

import { InternalNoteForm } from "./internal-note-form";
import {
	addJobInternalNote,
	deleteJobInternalNote,
	internalNoteErrorMessage,
	updateJobInternalNote,
} from "./job-internal-note-mutations";

type Props = {
	branchId: number;
	jobId: number;
	onChanged?: () => void;
};

/**
 * Staff-only notes on a job — never printed, never sent (plans/plan.md, constraint 1). Keeps
 * its own state: nothing here may be handed to a PDF builder or a WhatsApp send. Anyone may
 * append; edit and delete need JOBS_INTERNAL_NOTES_MANAGE (Admin passes every check).
 */
export const InternalNotesPanel = ({ branchId, jobId, onChanged }: Props) => {
	const currentUser = useAppSelector(selectCurrentUser);
	const dbName = useAppSelector(selectDbName);
	const schema = useAppSelector(selectSchema);
	const isReadOnly = useIsReadOnly();
	const canManage = hasAccessRight(currentUser, ACCESS_RIGHTS.JOBS_INTERNAL_NOTES_MANAGE);

	const [deleteId, setDeleteId] = useState<number | null>(null);
	const [deleting, setDeleting] = useState(false);
	const [editId, setEditId] = useState<number | null>(null);
	const [loading, setLoading] = useState(true);
	const [notes, setNotes] = useState<JobInternalNoteType[]>([]);

	const loadNotes = useCallback(async () => {
		if (!dbName || !schema) return;
		try {
			const res = await apolloClient.query<{ genericQuery: JobInternalNoteType[] | null }>({
				fetchPolicy: "network-only",
				query: GRAPHQL_MAP.genericQuery,
				variables: {
					db_name: dbName,
					schema,
					value: graphQlUtils.buildGenericQueryValue({
						sqlArgs: { job_id: jobId },
						sqlId: SQL_MAP.GET_JOB_INTERNAL_NOTES,
					}),
				},
			});
			setNotes(res.data?.genericQuery ?? []);
		} catch {
			toast.error(MESSAGES.ERROR_INTERNAL_NOTES_LOAD_FAILED);
		} finally {
			setLoading(false);
		}
	}, [dbName, jobId, schema]);

	useEffect(() => {
		void loadNotes();
	}, [loadNotes]);

	async function handleAdd(note: string): Promise<boolean> {
		try {
			await addJobInternalNote({ dbName: dbName ?? "", schema: schema ?? "" }, { branchId, jobId, note });
			toast.success(MESSAGES.SUCCESS_INTERNAL_NOTE_ADDED);
			await loadNotes();
			onChanged?.();
			return true;
		} catch (err) {
			toast.error(
				internalNoteErrorMessage(
					err,
					MESSAGES.ERROR_INTERNAL_NOTE_ADD_FAILED,
					MESSAGES.ERROR_INTERNAL_NOTE_NOT_FOUND,
				),
			);
			return false;
		}
	}

	async function handleDeleteConfirm() {
		if (deleteId === null) return;
		setDeleting(true);
		try {
			await deleteJobInternalNote({ dbName: dbName ?? "", schema: schema ?? "" }, { branchId, id: deleteId });
			toast.success(MESSAGES.SUCCESS_INTERNAL_NOTE_DELETED);
			onChanged?.();
		} catch (err) {
			toast.error(
				internalNoteErrorMessage(
					err,
					MESSAGES.ERROR_INTERNAL_NOTE_DELETE_FAILED,
					MESSAGES.ERROR_INTERNAL_NOTE_NOT_FOUND,
				),
			);
		} finally {
			setDeleting(false);
			setDeleteId(null);
			await loadNotes();
		}
	}

	async function handleEdit(id: number, note: string): Promise<boolean> {
		try {
			await updateJobInternalNote({ dbName: dbName ?? "", schema: schema ?? "" }, { branchId, id, note });
			toast.success(MESSAGES.SUCCESS_INTERNAL_NOTE_UPDATED);
			setEditId(null);
			await loadNotes();
			return true;
		} catch (err) {
			toast.error(
				internalNoteErrorMessage(
					err,
					MESSAGES.ERROR_INTERNAL_NOTE_UPDATE_FAILED,
					MESSAGES.ERROR_INTERNAL_NOTE_NOT_FOUND,
				),
			);
			await loadNotes();
			return false;
		}
	}

	return (
		<div className="overflow-hidden rounded-lg bg-white shadow-sm">
			<div className="h-1 bg-indigo-300" />
			<div className="flex flex-col gap-3 px-4 py-3">
				<div className="flex flex-col gap-0.5">
					<div className="flex items-center gap-2">
						<Lock className="h-3.5 w-3.5 text-indigo-600" />
						<span className="text-xs font-bold tracking-wider text-indigo-700 uppercase">
							Internal Notes
						</span>
						<span className="inline-flex items-center justify-center rounded-sm border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
							{notes.length}
						</span>
					</div>
					<span className="text-[11px] text-slate-500">{MESSAGES.INFO_INTERNAL_NOTES_HINT}</span>
				</div>

				<InternalNoteForm onSubmit={handleAdd} submitLabel="Add Note" />

				{loading ? (
					<div className="flex justify-center py-2">
						<Loader2 className="h-4 w-4 animate-spin text-slate-400" />
					</div>
				) : notes.length === 0 ? (
					<p className="text-xs text-slate-500">{MESSAGES.INFO_INTERNAL_NOTES_EMPTY}</p>
				) : (
					<div className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
						<AnimatePresence initial={false}>
							{notes.map((n) => (
								<motion.div
									animate={{ opacity: 1, y: 0 }}
									className="rounded-md border border-l-[3px] border-slate-200 border-l-indigo-300 bg-white px-3 py-2"
									exit={{ opacity: 0 }}
									initial={{ opacity: 0, y: -4 }}
									key={n.id}
								>
									<div className="flex items-start justify-between gap-2">
										<span className="text-[11px] text-slate-500">
											{formatDateTime(n.created_at)}
											{n.created_by_name && <span> · by {n.created_by_name}</span>}
										</span>
										{canManage && editId !== n.id && (
											<div className="flex shrink-0 items-center gap-0.5">
												<Button
													aria-label="Edit note"
													className="h-6 w-6 text-slate-500 hover:text-slate-700"
													disabled={isReadOnly}
													onClick={() => setEditId(n.id)}
													size="icon"
													title={isReadOnly ? MESSAGES.READ_ONLY_TOOLTIP : "Edit"}
													type="button"
													variant="ghost"
												>
													<Pencil className="h-3.5 w-3.5" />
												</Button>
												<Button
													aria-label="Delete note"
													className="h-6 w-6 text-slate-500 hover:text-slate-700"
													disabled={isReadOnly}
													onClick={() => setDeleteId(n.id)}
													size="icon"
													title={isReadOnly ? MESSAGES.READ_ONLY_TOOLTIP : "Delete"}
													type="button"
													variant="ghost"
												>
													<Trash2 className="h-3.5 w-3.5" />
												</Button>
											</div>
										)}
									</div>
									{editId === n.id ? (
										<div className="mt-1.5">
											<InternalNoteForm
												defaultValue={n.note}
												onCancel={() => setEditId(null)}
												onSubmit={(note) => handleEdit(n.id, note)}
												submitLabel="Save"
											/>
										</div>
									) : (
										<p className="mt-1 text-sm leading-relaxed break-words whitespace-pre-wrap text-slate-900">
											{n.note}
										</p>
									)}
									{n.updated_at && editId !== n.id && (
										<span className="mt-1 block text-[10.5px] text-slate-400 italic">
											edited
											{n.updated_by_name ? ` by ${n.updated_by_name}` : ""},{" "}
											{formatDateTime(n.updated_at)}
										</span>
									)}
								</motion.div>
							))}
						</AnimatePresence>
					</div>
				)}

				{!canManage && notes.length > 0 && (
					<p className="text-[11px] text-slate-500">{MESSAGES.INFO_INTERNAL_NOTES_EDIT_RESTRICTED}</p>
				)}
			</div>

			<AlertDialog onOpenChange={(open) => !open && !deleting && setDeleteId(null)} open={deleteId !== null}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Note</AlertDialogTitle>
						<AlertDialogDescription>{MESSAGES.CONFIRM_INTERNAL_NOTE_DELETE}</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							disabled={deleting}
							onClick={(e) => {
								e.preventDefault();
								void handleDeleteConfirm();
							}}
						>
							{deleting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
};
