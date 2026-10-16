import { useState } from "react";
import { Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { runEnquiryMutation } from "@/components/shared/enquiries/enquiry-mutation";
import type { EnquiryRowType } from "@/components/shared/enquiries/enquiry-types";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";

type DeleteEnquiryButtonPropsType = {
	/** "" for the control plane (Enterprise). */
	dbName: string;
	/** deleteSalesEnquiry (Admin → Enquiries) or deleteEnterpriseEnquiry (Super Admin → Enquiries). */
	field: "deleteEnterpriseEnquiry" | "deleteSalesEnquiry";
	onDeleted: () => void;
	row: EnquiryRowType;
};

/** The red Delete action of a rejected enquiry, with the typed-confirmation dialog. The server
 * refuses any request that is not rejected. */
export const DeleteEnquiryButton = ({ dbName, field, onDeleted, row }: DeleteEnquiryButtonPropsType) => {
	const [open, setOpen] = useState(false);
	const confirmKey = row.reference ?? row.business_name;

	return (
		<>
			<Button
				className="h-7 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
				size="sm"
				variant="ghost"
				onClick={() => setOpen(true)}
			>
				<Trash2Icon className="mr-1 h-3.5 w-3.5" />
				Delete
			</Button>
			<DeleteConfirmDialog
				confirmFieldLabel={row.reference ? "reference" : "business name"}
				confirmKey={confirmKey}
				confirmKeyClass={row.reference ? "font-mono" : undefined}
				entityName={`${row.business_name}${row.reference ? ` · ${row.reference}` : ""}`}
				open={open}
				title="Delete rejected request"
				toastMessages={{ error: MESSAGES.ENQUIRY_DELETE_FAILED, success: MESSAGES.ENQUIRY_DELETED }}
				onDelete={async () => {
					await runEnquiryMutation(GRAPHQL_MAP[field], field, dbName, { id: row.id });
				}}
				onOpenChange={setOpen}
				onSuccess={onDeleted}
			/>
		</>
	);
};
