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
import { markBuSeedExists } from "@/features/admin/store/admin-slice";
import type { BusinessUnitType } from "@/features/admin/types/index";

// ─── Types ────────────────────────────────────────────────────────────────────

type FeedBuSeedDataDialogPropsType = {
    bu:           BusinessUnitType;
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const FeedBuSeedDataDialog = ({
    bu,
    onOpenChange,
    onSuccess,
    open,
}: FeedBuSeedDataDialogPropsType) => {
    const dispatch = useAppDispatch();
    const dbName   = useAppSelector(selectDbName);

    const [seedError, setFeedError] = useState<string | null>(null);
    const [done,      setDone]      = useState(false);
    const [retryKey,  setRetryKey]  = useState(0);

    // Reset state and kick off first run whenever dialog opens
    useEffect(() => {
        if (open) {
            setFeedError(null);
            setDone(false);
            setRetryKey((k) => k + 1);
        }
    }, [open]);

    // Mutation fires only when retryKey increments (initial open + each retry)
    useEffect(() => {
        if (!retryKey || !dbName) return;
        setFeedError(null);
        apolloClient
            .mutate<{ feedBuSeedData: { code: string } }>({
                mutation: GRAPHQL_MAP.feedBuSeedData,
                variables: {
                    db_name: dbName,
                    schema: "security",
                    value: encodeURIComponent(
                        JSON.stringify({ code: bu.code.toLowerCase() })
                    ),
                },
            })
            .then(() => {
                dispatch(markBuSeedExists(bu.id));
                setDone(true);
            })
            .catch((err) => {
                const msg =
                    err?.errors?.[0]?.message ??
                    MESSAGES.ERROR_BU_SEED_FEED_FAILED;
                setFeedError(msg);
            });
    }, [retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-full sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-foreground">
                        Add Seed Data
                    </DialogTitle>
                </DialogHeader>

                {/* Loading */}
                {!done && !seedError && (
                    <div className="flex flex-col items-center gap-4 py-6">
                        <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
                        <p className="text-sm text-slate-500">
                            Adding seed data for <span className="font-medium">{bu.name}</span>…
                        </p>
                    </div>
                )}

                {/* Error */}
                {seedError && (
                    <div className="flex flex-col items-center gap-4 py-6">
                        <p className="text-center text-sm text-red-500">{seedError}</p>
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
                        <p className="text-lg font-semibold text-slate-800">Seed Data Added</p>
                        <p className="text-sm text-slate-500">
                            Seed data for{" "}
                            <span className="font-medium">{bu.name}</span>{" "}
                            ({bu.code}) has been added successfully.
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
