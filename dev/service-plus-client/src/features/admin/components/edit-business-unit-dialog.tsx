import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";

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
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import type { BusinessUnitType } from "@/features/admin/types/index";

// ─── Types ────────────────────────────────────────────────────────────────────

type EditBusinessUnitDialogPropsType = {
    bu: BusinessUnitType;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    open: boolean;
};

type EditBusinessUnitFormType = z.infer<typeof editBusinessUnitSchema>;

// ─── Schema ───────────────────────────────────────────────────────────────────

const editBusinessUnitSchema = z.object({
    name: z
        .string()
        .min(2, "Name must be at least 2 characters")
        .regex(/^[a-zA-Z0-9 ]+$/, "Name can only contain letters, numbers and spaces."),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
    return (
        <AnimatePresence>
            {message && (
                <motion.p
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-red-500"
                    exit={{ opacity: 0, y: -4 }}
                    initial={{ opacity: 0, y: -4 }}
                >
                    {message}
                </motion.p>
            )}
        </AnimatePresence>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export const EditBusinessUnitDialog = ({
    bu,
    onOpenChange,
    onSuccess,
    open,
}: EditBusinessUnitDialogPropsType) => {
    const dbName = useAppSelector(selectDbName);

    const form = useForm<EditBusinessUnitFormType>({
        defaultValues: { name: bu.name },
        mode: "onChange",
        resolver: zodResolver(editBusinessUnitSchema),
    });

    const { formState: { errors } } = form;

    // Reset form when bu changes or dialog opens
    useEffect(() => {
        if (open) {
            form.reset({ name: bu.name });
        }
    }, [open, bu]); // eslint-disable-line react-hooks/exhaustive-deps

    async function onSubmit(data: EditBusinessUnitFormType) {
        if (!dbName) return;
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema: "security",
                    value: graphQlUtils.buildGenericUpdateValue({
                        tableName: "bu",
                        xData: { id: bu.id, name: data.name },
                    }),
                },
            });
            toast.success(MESSAGES.SUCCESS_BU_UPDATED);
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error(MESSAGES.ERROR_BU_UPDATE_FAILED);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-full sm:max-w-[420px]">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-foreground">
                        Edit Business Unit
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                        Update the name of this business unit.
                    </DialogDescription>
                </DialogHeader>

                <form className="flex flex-col gap-4 pt-1" onSubmit={form.handleSubmit(onSubmit)}>
                    {/* Code (read-only) */}
                    <div className="flex flex-col gap-1.5">
                        <Label>Code</Label>
                        <Input
                            className="font-mono text-slate-500"
                            disabled
                            readOnly
                            value={bu.code.toLowerCase()}
                        />
                        <p className="text-[11px] text-slate-400">Code cannot be changed.</p>
                    </div>

                    {/* Name */}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="edit_bu_name">
                            Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            autoComplete="off"
                            disabled={submitting}
                            id="edit_bu_name"
                            placeholder="e.g. Main Workshop"
                            {...form.register("name")}
                        />
                        <FieldError message={errors.name?.message} />
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
                            className="bg-teal-600 text-white hover:bg-teal-700"
                            disabled={submitting || Object.keys(errors).length > 0}
                            type="submit"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                "Save Changes"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
