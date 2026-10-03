"use client";

import { Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MESSAGES } from "@/constants/messages";

type LiteConfirmDialogPropsType = {
	businessName: string;
	email: string;
	onCancel: () => void;
	onConfirm: () => void;
	open: boolean;
	submitting: boolean;
};

// Lite is the one plan created by approval rather than a sales call, so the visitor confirms the
// business name and email first. Cancel closes the dialog and keeps everything typed in the form.
export const LiteConfirmDialog = ({
	businessName,
	email,
	onCancel,
	onConfirm,
	open,
	submitting,
}: LiteConfirmDialogPropsType) => (
	<Dialog onOpenChange={(next) => !next && !submitting && onCancel()} open={open}>
		<DialogContent>
			<DialogHeader>
				<DialogTitle>{MESSAGES.liteConfirmTitle}</DialogTitle>
				<DialogDescription>{MESSAGES.liteConfirmBody}</DialogDescription>
			</DialogHeader>
			<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-xl border border-border bg-muted/40 p-4 text-sm">
				<dt className="text-muted-foreground">Business</dt>
				<dd className="font-medium break-words">{businessName}</dd>
				<dt className="text-muted-foreground">Email</dt>
				<dd className="font-medium break-words">{email}</dd>
			</dl>
			<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
				<Button disabled={submitting} onClick={onCancel} type="button" variant="outline">
					Cancel
				</Button>
				<Button disabled={submitting} onClick={onConfirm} type="button">
					{submitting ? <Loader2 className="animate-spin" /> : <Send />}
					{submitting ? "Sending…" : "Confirm signup"}
				</Button>
			</div>
		</DialogContent>
	</Dialog>
);
