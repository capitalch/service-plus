import { useEffect, useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { apolloClient } from "@/lib/apollo-client";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import type { BusinessUnitType } from "@/features/admin/types/index";

type Props = {
    bu:           BusinessUnitType;
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
};

export const MigrateBuSchemaDialog = ({ bu, onOpenChange, onSuccess, open }: Props) => {
    const dbName = useAppSelector(selectDbName);

    const [error,    setError]    = useState<string | null>(null);
    const [done,     setDone]     = useState(false);
    const [retryKey, setRetryKey] = useState(0);

    useEffect(() => {
        if (open) { setError(null); setDone(false); setRetryKey(k => k + 1); }
    }, [open]);

    useEffect(() => {
        if (!retryKey || !dbName) return;
        setError(null);
        apolloClient
            .mutate<{ migrateBuSchema: { code: string } }>({
                mutation: GRAPHQL_MAP.migrateBuSchema,
                variables: {
                    db_name: dbName,
                    schema: "security",
                    value: encodeURIComponent(JSON.stringify({ code: bu.code.toLowerCase() })),
                },
            })
            .then(() => setDone(true))
            .catch(err => {
                setError(err?.errors?.[0]?.message ?? MESSAGES.ERROR_GENERIC);
            });
    }, [retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined} className="w-full sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-foreground">
                        Migrate Schema
                    </DialogTitle>
                </DialogHeader>

                {!done && !error && (
                    <div className="flex flex-col items-center gap-4 py-6">
                        <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
                        <p className="text-sm text-slate-500">
                            Migrating <span className="font-medium">{bu.name}</span> to the latest schema…
                        </p>
                    </div>
                )}

                {error && (
                    <div className="flex flex-col items-center gap-4 py-6">
                        <p className="text-center text-sm text-red-500">{error}</p>
                        <DialogFooter className="w-full pt-2">
                            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button
                                className="bg-teal-600 text-white hover:bg-teal-700"
                                onClick={() => setRetryKey(k => k + 1)}
                            >
                                Retry
                            </Button>
                        </DialogFooter>
                    </div>
                )}

                {done && (
                    <div className="flex flex-col items-center gap-4 py-6 text-center">
                        <CheckCircle className="h-12 w-12 text-emerald-500" />
                        <p className="text-lg font-semibold text-slate-800">Migration Complete</p>
                        <p className="text-sm text-slate-500">
                            <span className="font-medium">{bu.name}</span> ({bu.code}) has been upgraded successfully.
                        </p>
                        <DialogFooter className="w-full justify-center pt-2">
                            <Button
                                className="bg-teal-600 text-white hover:bg-teal-700"
                                onClick={() => { onSuccess(); onOpenChange(false); }}
                            >
                                Done
                            </Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};
