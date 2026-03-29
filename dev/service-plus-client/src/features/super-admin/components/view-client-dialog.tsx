import { CheckCircle2Icon, XCircleIcon } from "lucide-react";
import { motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { ClientType } from "@/features/super-admin/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewClientDialogPropsType = {
	client: ClientType | null;
	onOpenChange: (open: boolean) => void;
	open: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: string): string {
	return new Date(date).toLocaleDateString("en-IN", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div className="flex flex-col gap-0.5">
			<span className="text-xs font-medium text-slate-500">{label}</span>
			<span className="text-sm text-slate-800">{value || <span className="text-slate-400">—</span>}</span>
		</div>
	);
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ViewClientDialog = ({ client, onOpenChange, open }: ViewClientDialogPropsType) => {
	if (!client) return null;

	const addressParts = [
		client.address_line1,
		client.address_line2,
		client.city,
		client.state,
		client.pincode,
		client.country_code,
	].filter(Boolean);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent aria-describedby={undefined} className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Client Details</DialogTitle>
				</DialogHeader>

				<motion.div
					animate={{ opacity: 1, y: 0 }}
					className="flex flex-col gap-4 py-1"
					initial={{ opacity: 0, y: 8 }}
					transition={{ duration: 0.2 }}
				>
					{/* Identity */}
					<div className="grid grid-cols-2 gap-3">
						<FieldRow label="Code" value={<span className="font-mono">{client.code}</span>} />
						<FieldRow label="Name" value={client.name} />
					</div>

					{/* Status */}
					<div className="grid grid-cols-2 gap-3">
						<div className="flex flex-col gap-0.5">
							<span className="text-xs font-medium text-slate-500">Status</span>
							<Badge
								className={
									client.is_active
										? "w-fit border-emerald-200 bg-emerald-50 text-emerald-700"
										: "w-fit border-slate-200 bg-slate-100 text-slate-500"
								}
								variant="outline"
							>
								<span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${client.is_active ? "bg-emerald-500" : "bg-slate-400"}`} />
								{client.is_active ? "Active" : "Inactive"}
							</Badge>
						</div>
						<div className="flex flex-col gap-0.5">
							<span className="text-xs font-medium text-slate-500">Admins (Active / Inactive)</span>
							<span className="text-sm">
								<span className="font-semibold text-teal-600">{client.activeAdminCount}</span>
								<span className="mx-1 text-slate-300">/</span>
								<span className={`font-semibold ${client.inactiveAdminCount > 0 ? "text-red-500" : "text-slate-400"}`}>
									{client.inactiveAdminCount}
								</span>
							</span>
						</div>
					</div>

					<Separator />

					{/* Contact */}
					<div className="grid grid-cols-2 gap-3">
						<FieldRow label="Email" value={client.email} />
						<FieldRow label="Phone" value={client.phone} />
					</div>

					{/* Tax IDs */}
					<div className="grid grid-cols-2 gap-3">
						<FieldRow label="GSTIN" value={client.gstin ? <span className="font-mono">{client.gstin}</span> : null} />
						<FieldRow label="PAN" value={client.pan ? <span className="font-mono">{client.pan}</span> : null} />
					</div>

					{/* Address */}
					<FieldRow
						label="Address"
						value={addressParts.length > 0 ? addressParts.join(", ") : null}
					/>

					<Separator />

					{/* Database */}
					<div className="flex flex-col gap-0.5">
						<span className="text-xs font-medium text-slate-500">Database</span>
						<span className="flex items-center gap-1.5 font-mono text-sm text-slate-600">
							{client.db_name ?? <span className="text-slate-400">—</span>}
							{client.db_name && client.db_name_valid && (
								<span title="Database exists"><CheckCircle2Icon className="h-3.5 w-3.5 text-emerald-500" /></span>
							)}
							{client.db_name && !client.db_name_valid && (
								<span title="Database does not exist"><XCircleIcon className="h-3.5 w-3.5 text-red-500" /></span>
							)}
						</span>
					</div>

					{/* Timestamps */}
					<div className="grid grid-cols-2 gap-3">
						<FieldRow label="Created On" value={formatDate(client.created_at)} />
						<FieldRow label="Last Updated" value={formatDate(client.updated_at)} />
					</div>
				</motion.div>

				<DialogFooter>
					<Button
						className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
						variant="outline"
						onClick={() => onOpenChange(false)}
					>
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
