import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { selectCurrentUser, selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj } from "@/lib/graphql-utils";
import { selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import type { JobControlRow, TechnicianRow } from "@/features/client/types/job";

// ─── Types ────────────────────────────────────────────────────────────────────

type SetTechnicianDialogPropsType = {
	job: JobControlRow;
	onClose: () => void;
	onSuccess: () => void;
	technicians: TechnicianRow[];
};

// ─── Component ────────────────────────────────────────────────────────────────

export const SetTechnicianDialog = ({ job, onClose, onSuccess, technicians }: SetTechnicianDialogPropsType) => {
	const [submitting, setSubmitting] = useState(false);
	const [technicianId, setTechnicianId] = useState<string>(job.technician_id ? String(job.technician_id) : "");
	const currentUser = useAppSelector(selectCurrentUser);
	const dbName = useAppSelector(selectDbName);
	const schema = useAppSelector(selectSchema);

	const unchanged = !technicianId || Number(technicianId) === job.technician_id;

	async function handleSubmit() {
		if (!dbName || !schema || unchanged) return;
		setSubmitting(true);
		try {
			await apolloClient.mutate({
				mutation: GRAPHQL_MAP.updateJob,
				variables: {
					db_name: dbName,
					schema,
					value: encodeObj({
						job_id: job.id,
						last_transaction_id: job.last_transaction_id,
						performed_by_user_id: currentUser?.id ?? null,
						remarks: "",
						transaction_date: null,
						xData: {
							amount: job.amount,
							estimate_amount: job.estimate_amount,
							id: job.id,
							is_closed: job.is_closed,
							is_final: job.is_final,
							job_status_id: job.job_status_id,
							technician_id: Number(technicianId),
						},
					}),
				},
			});
			toast.success(MESSAGES.SUCCESS_JOB_TECHNICIAN_SET);
			onSuccess();
			onClose();
		} catch {
			toast.error(MESSAGES.ERROR_JOB_UPDATE_FAILED);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Dialog open onOpenChange={(o) => !o && !submitting && onClose()}>
			<DialogContent aria-describedby={undefined} className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="text-base font-semibold text-foreground">
						Set Technician — {job.job_no}
					</DialogTitle>
				</DialogHeader>
				<div className="flex flex-col gap-1.5 pt-1">
					<Label htmlFor="st_technician">
						Technician <span className="text-red-500">*</span>
					</Label>
					<Select value={technicianId} onValueChange={setTechnicianId}>
						<SelectTrigger id="st_technician">
							<SelectValue placeholder="Select technician" />
						</SelectTrigger>
						<SelectContent>
							{technicians
								.filter((t) => t.is_active || t.id === job.technician_id)
								.map((t) => (
									<SelectItem key={t.id} value={String(t.id)}>
										{t.name}
									</SelectItem>
								))}
						</SelectContent>
					</Select>
				</div>
				<DialogFooter className="pt-2">
					<Button disabled={submitting} type="button" variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button
						className="bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
						disabled={unchanged || submitting}
						type="button"
						onClick={() => void handleSubmit()}
					>
						{submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
						Set Technician
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
