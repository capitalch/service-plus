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
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { markBuSchemaExists } from "@/features/admin/store/admin-slice";
import type { BusinessUnitType } from "@/features/admin/types/index";

// ─── Types ────────────────────────────────────────────────────────────────────

type CreateBuSchemaDialogPropsType = {
    bu:           BusinessUnitType;
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const CreateBuSchemaDialog = ({
    bu,
    onOpenChange,
    onSuccess,
    open,
}: CreateBuSchemaDialogPropsType) => {
    const dispatch = useAppDispatch();
    const dbName   = useAppSelector(selectDbName);

    const [createError, setCreateError] = useState<string | null>(null);
    const [done,        setDone]        = useState(false);
    const [retryKey,    setRetryKey]    = useState(0);

    // Reset state and kick off first run whenever dialog opens
    useEffect(() => {
        if (open) {
            setCreateError(null);
            setDone(false);
            setRetryKey((k) => k + 1);
        }
    }, [open]);

    // Mutation fires only when retryKey increments (initial open + each retry)
    useEffect(() => {
        if (!retryKey || !dbName) return;
        setCreateError(null);
        apolloClient
            .mutate<{ createBuSchemaAndFeedSeedData: { code: string; id: number; name: string } }>({
                mutation: GRAPHQL_MAP.createBuSchemaAndFeedSeedData,
                variables: {
                    db_name: dbName,
                    schema: "security",
                    value: encodeURIComponent(
                        JSON.stringify({ code: bu.code.toLowerCase(), id: bu.id, name: bu.name })
                    ),
                },
            })
            .then(() => {
                dispatch(markBuSchemaExists(bu.id));
                setDone(true);
            })
            .catch((err) => {
                const msg =
                    err?.errors?.[0]?.message ??
                    MESSAGES.ERROR_BU_CREATE_SCHEMA_FAILED;
                setCreateError(msg);
            });
    }, [retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined} className="w-full sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-foreground">
                        Create Schema & Seed Data
                    </DialogTitle>
                </DialogHeader>

                {/* Creating */}
                {!done && !createError && (
                    <div className="flex flex-col items-center gap-4 py-6">
                        <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
                        <p className="text-sm text-slate-500">
                            Setting up schema for <span className="font-medium">{bu.name}</span>…
                        </p>
                    </div>
                )}

                {/* Error */}
                {createError && (
                    <div className="flex flex-col items-center gap-4 py-6">
                        <p className="text-center text-sm text-red-500">{createError}</p>
                        <DialogFooter className="w-full pt-2">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="bg-teal-600 text-white hover:bg-teal-700"
                                type="button"
                                onClick={() => setRetryKey((k) => k + 1)}
                            >
                                Retry
                            </Button>
                        </DialogFooter>
                    </div>
                )}

                {/* Done */}
                {done && (
                    <div className="flex flex-col items-center gap-4 py-6 text-center">
                        <CheckCircle className="h-12 w-12 text-emerald-500" />
                        <p className="text-lg font-semibold text-slate-800">Schema Created</p>
                        <p className="text-sm text-slate-500">
                            Schema and seed data for{" "}
                            <span className="font-medium">{bu.name}</span>{" "}
                            ({bu.code}) have been set up successfully.
                        </p>
                        <DialogFooter className="w-full justify-center pt-2">
                            <Button
                                className="bg-teal-600 text-white hover:bg-teal-700"
                                type="button"
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
