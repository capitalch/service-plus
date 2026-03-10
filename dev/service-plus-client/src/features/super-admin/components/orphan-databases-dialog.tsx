import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation } from "@apollo/client/react";
import { DatabaseIcon, InfoIcon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrphanDatabasesDialogPropsType = {
	databases: string[];
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
	open: boolean;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const OrphanDatabasesDialog = ({ databases, onOpenChange, onSuccess, open }: OrphanDatabasesDialogPropsType) => {
	const [confirmInput, setConfirmInput] = useState("");
	const [deletingDb, setDeletingDb] = useState<string | null>(null);
	const [localDatabases, setLocalDatabases] = useState<string[]>(databases);

	const [executeDropDatabase, { loading: dropping }] = useMutation(GRAPHQL_MAP.dropDatabase);

	useEffect(() => {
		setLocalDatabases(databases);
	}, [databases]);

	useEffect(() => {
		if (!open) {
			setConfirmInput("");
			setDeletingDb(null);
		}
	}, [open]);

	const isNameMatch = confirmInput === deletingDb;

	async function handleConfirmDelete() {
		if (!deletingDb || !isNameMatch) return;
		try {
			const result = await executeDropDatabase({ variables: { db_name: deletingDb } });
			if (result.errors?.length) {
				toast.error(MESSAGES.ERROR_ORPHAN_DB_DELETE_FAILED);
				return;
			}
			toast.success(MESSAGES.SUCCESS_ORPHAN_DB_DELETED);
			setLocalDatabases((prev) => prev.filter((d) => d !== deletingDb));
			setConfirmInput("");
			setDeletingDb(null);
			onSuccess();
		} catch {
			toast.error(MESSAGES.ERROR_ORPHAN_DB_DELETE_FAILED);
		}
	}

	const handleDeleteClick = (db: string) => {
		setDeletingDb(db);
		setConfirmInput("");
	};

	const handleCancelDelete = () => {
		setConfirmInput("");
		setDeletingDb(null);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Orphan Databases</DialogTitle>
					<DialogDescription>
						Databases that exist on the server but are not linked to any client.
					</DialogDescription>
				</DialogHeader>

				<div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
					<InfoIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
					<p className="text-sm text-blue-700">
						An orphan database is a PostgreSQL database that exists physically on the server but has no corresponding client entry. This typically happens when a client was deleted or its database was detached without being physically dropped.
					</p>
				</div>

				{localDatabases.length === 0 ? (
					<p className="py-4 text-center text-sm text-slate-400">
						{MESSAGES.INFO_NO_ORPHAN_DATABASES}
					</p>
				) : (
					<ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
						{localDatabases.map((db) => (
							<li key={db}>
								{/* DB name row */}
								<div className="flex items-center justify-between gap-2.5 px-3 py-2.5">
									<div className="flex items-center gap-2.5">
										<DatabaseIcon className="h-3.5 w-3.5 flex-shrink-0 text-orange-400" />
										<span className="font-mono text-sm text-slate-700">{db}</span>
									</div>
									{deletingDb !== db && (
										<Button
											className="h-6 border-red-200 bg-red-50 px-2 text-xs text-red-600 hover:bg-red-100 hover:text-red-700"
											disabled={dropping}
											size="sm"
											variant="outline"
											onClick={() => handleDeleteClick(db)}
										>
											Delete
										</Button>
									)}
								</div>

								{/* Inline confirmation panel */}
								<AnimatePresence>
									{deletingDb === db && (
										<motion.div
											animate={{ height: "auto", opacity: 1 }}
											className="overflow-hidden border-t border-red-100 bg-red-50/60 px-3 pb-3 pt-2.5"
											exit={{ height: 0, opacity: 0 }}
											initial={{ height: 0, opacity: 0 }}
											transition={{ duration: 0.2, ease: "easeInOut" }}
										>
											<div className="mb-2 flex items-start gap-2">
												<TriangleAlertIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-500" />
												<p className="text-xs text-red-600">
													This will permanently drop the database from the server. This action cannot be undone.
												</p>
											</div>
											<div className="mb-1">
												<Label className="mb-1 block text-xs text-slate-600">
													Type the database name to confirm
												</Label>
												<Input
													autoFocus
													className="h-7 font-mono text-xs"
													disabled={dropping}
													placeholder={db}
													value={confirmInput}
													onChange={(e) => setConfirmInput(e.target.value)}
												/>
												{confirmInput.length > 0 && !isNameMatch && (
													<p className="mt-1 text-xs text-red-500">
														{MESSAGES.ERROR_ORPHAN_DB_NAME_MISMATCH}
													</p>
												)}
											</div>
											<div className="mt-2.5 flex justify-end gap-2">
												<Button
													className="h-7 px-3 text-xs"
													disabled={dropping}
													variant="ghost"
													onClick={handleCancelDelete}
												>
													Cancel
												</Button>
												<Button
													className="h-7 bg-red-600 px-3 text-xs text-white hover:bg-red-700"
													disabled={!isNameMatch || dropping}
													onClick={handleConfirmDelete}
												>
													{dropping ? "Dropping..." : "Drop Database"}
												</Button>
											</div>
										</motion.div>
									)}
								</AnimatePresence>
							</li>
						))}
					</ul>
				)}

				<DialogFooter>
					<Button disabled={dropping} variant="ghost" onClick={() => onOpenChange(false)}>
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
