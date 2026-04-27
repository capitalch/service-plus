import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { useDebounce } from "@/hooks/use-debounce";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";

// ─── Types ────────────────────────────────────────────────────────────────────

type AddPartLocationDialogPropsType = {
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
};

type AddPartLocationFormType = z.infer<typeof addPartLocationSchema>;

type CheckQueryDataType = {
    genericQuery: { exists: boolean }[] | null;
};

// ─── Schema ───────────────────────────────────────────────────────────────────

const addPartLocationSchema = z.object({
    location: z.string().min(1, "Location is required").max(100, "Location must be 100 characters or fewer"),
});

// ─── Field error ──────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
    return message ? <p className="text-xs text-red-500">{message}</p> : null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AddPartLocationDialog = ({
    onOpenChange,
    onSuccess,
    open,
}: AddPartLocationDialogPropsType) => {
    const [checkingLocation, setCheckingLocation] = useState(false);
    const [locationTaken,    setLocationTaken]    = useState<boolean | null>(null);
    const dbName        = useAppSelector(selectDbName);
    const schema        = useAppSelector(selectSchema);
    const currentBranch = useAppSelector(selectCurrentBranch);

    const form = useForm<AddPartLocationFormType>({
        defaultValues: { location: "" },
        mode:     "onChange",
        resolver: zodResolver(addPartLocationSchema) as any,
    });

    const { formState: { errors } } = form;
    const locationValue = useWatch({ control: form.control, name: "location" });
    const debouncedLoc  = useDebounce(locationValue, 1200);

    // Reset on close
    useEffect(() => {
        if (!open) {
            setCheckingLocation(false);
            setLocationTaken(null);
            form.reset();
        }
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    // Location uniqueness check (scoped to current branch)
    useEffect(() => {
        if (!debouncedLoc || !currentBranch || !dbName || !schema) {
            setLocationTaken(null);
            return;
        }
        if (form.getFieldState("location").invalid) { setLocationTaken(null); return; }
        setCheckingLocation(true);
        apolloClient
            .query<CheckQueryDataType>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { branch_id: currentBranch.id, location: debouncedLoc },
                        sqlId:   SQL_MAP.CHECK_PART_LOCATION_EXISTS,
                    }),
                },
            })
            .then((res) => {
                const exists = res.data?.genericQuery?.[0]?.exists ?? false;
                setLocationTaken(exists);
                if (exists) form.setError("location", { message: MESSAGES.ERROR_PART_LOCATION_EXISTS, type: "manual" });
                else form.clearErrors("location");
            })
            .catch(() => setLocationTaken(null))
            .finally(() => setCheckingLocation(false));
    }, [debouncedLoc]); // eslint-disable-line react-hooks/exhaustive-deps

    async function onSubmit(data: AddPartLocationFormType) {
        if (!dbName || !schema || !currentBranch) return;
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericUpdateValue({
                        tableName: "stock_location_master",
                        xData: {
                            branch_id: currentBranch.id,
                            name:      data.location,
                        },
                    }),
                },
            });
            toast.success(MESSAGES.SUCCESS_PART_LOCATION_CREATED);
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error(MESSAGES.ERROR_PART_LOCATION_CREATE_FAILED);
        } finally {
            setSubmitting(false);
        }
    }

    const submitDisabled = checkingLocation || locationTaken === true || Object.keys(errors).length > 0 || submitting;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined} className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-foreground">
                        Add Part Location
                    </DialogTitle>
                </DialogHeader>

                <form className="flex flex-col gap-4 pt-1" onSubmit={form.handleSubmit(onSubmit)}>
                    {/* Location */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="apl_location">
                            Location <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                            <Input
                                autoComplete="off"
                                id="apl_location"
                                placeholder="e.g. Shelf A, Bin 1, Warehouse 2"
                                {...form.register("location")}
                            />
                            {checkingLocation && (
                                <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                            )}
                            {!checkingLocation && locationTaken === false && !errors.location && (
                                <Check className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                            )}
                        </div>
                        <FieldError message={errors.location?.message} />
                    </div>

                    <DialogFooter className="pt-2">
                        <Button
                            disabled={submitting}
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
                            disabled={submitDisabled}
                            type="submit"
                        >
                            {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                            Add Location
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
