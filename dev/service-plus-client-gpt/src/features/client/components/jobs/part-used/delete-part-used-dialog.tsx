import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";

import type { ConsumptionRow } from "./part-used-schema";

type Props = {
    row:       ConsumptionRow | null;
    onClose:   () => void;
    onDeleted: () => void;
};

export const DeletePartUsedDialog = ({ row, onClose, onDeleted }: Props) => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        if (!row || !dbName || !schema) return;
        if (row.is_closed || row.is_final) return;
        setDeleting(true);
        try {
            await apolloClient.mutate({
                mutation:  GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName, schema,
                    value: graphQlUtils.buildGenericUpdateValue({
                        tableName:  "job_part_used",
                        deletedIds: [row.id],
                        xData:      {},
                    }),
                },
            });
            toast.success(MESSAGES.SUCCESS_PART_USED_DELETED);
            onDeleted();
        } catch { toast.error(MESSAGES.ERROR_PART_USED_DELETE_FAILED); }
        finally { setDeleting(false); }
    };

    return (
        <Dialog open={row !== null} onOpenChange={open => { if (!open && !deleting) onClose(); }}>
            <DialogContent
                aria-describedby={undefined}
                className="sm:max-w-sm !bg-white text-(--cl-text)"
                onPointerDownOutside={e => e.preventDefault()}
                onEscapeKeyDown={e => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle>Delete Part Usage</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-(--cl-text-muted)">
                    Delete <span className="font-semibold text-(--cl-text)">{row?.part_name}</span> ({row?.qty} {row?.uom}) from job{" "}
                    <span className="font-mono font-semibold text-(--cl-accent)">{row?.job_no}</span>?
                    <br /><br />
                    This will also remove the stock transaction and restore the stock balance.
                </p>
                <DialogFooter>
                    <Button disabled={deleting} variant="outline" onClick={onClose}>Cancel</Button>
                    <Button disabled={deleting} variant="destructive" onClick={() => void handleDelete()}>
                        {deleting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                        Delete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
