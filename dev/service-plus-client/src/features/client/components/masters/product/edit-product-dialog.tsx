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
import { SQL_MAP } from "@/constants/sql-map";
import { useDebounce } from "@/hooks/use-debounce";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import type { ProductType } from "@/features/client/types/product";

// ─── Types ────────────────────────────────────────────────────────────────────

type EditProductDialogPropsType = {
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
    product:      ProductType;
};

type CheckQueryDataType = {
    genericQuery: { exists: boolean }[] | null;
};

const schema = z.object({
    name: z.string().min(1, "Name is required").max(60)
        .regex(/^[A-Za-z_]+$/, "Only letters and underscores")
        .transform(v => v.toUpperCase()),
});

type FormType = z.infer<typeof schema>;

// ─── Field error ──────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
    return message ? <p className="text-xs text-red-500">{message}</p> : null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const EditProductDialog = ({
    onOpenChange,
    onSuccess,
    open,
    product,
}: EditProductDialogPropsType) => {
    const [checkingName, setCheckingName] = useState(false);
    const [nameTaken,    setNameTaken]    = useState<boolean | null>(null);
    const dbName  = useAppSelector(selectDbName);
    const schema_ = useAppSelector(selectSchema);

    const form = useForm<FormType>({
        mode:     "onChange",
        resolver: zodResolver(schema),
    });

    const { formState: { errors } } = form;
    const nameValue     = useWatch({ control: form.control, name: "name" });
    const debouncedName = useDebounce(nameValue, 1200);

    useEffect(() => {
        if (!open) return;
        form.reset({ name: product.name });
        setNameTaken(null);
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!debouncedName || !dbName || !schema_) { setNameTaken(null); return; }
        if (form.getFieldState("name").invalid) { setNameTaken(null); return; }
        if (debouncedName.toUpperCase() === product.name) { setNameTaken(false); return; }
        setCheckingName(true);
        apolloClient
            .query<CheckQueryDataType>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema:  schema_,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { id: product.id, name: debouncedName.toUpperCase() },
                        sqlId:   SQL_MAP.CHECK_PRODUCT_NAME_EXISTS_EXCLUDE_ID,
                    }),
                },
            })
            .then((res) => {
                const exists = res.data?.genericQuery?.[0]?.exists ?? false;
                setNameTaken(exists);
                if (exists) form.setError("name", { message: "A product with this name already exists.", type: "manual" });
                else form.clearErrors("name");
            })
            .catch(() => setNameTaken(null))
            .finally(() => setCheckingName(false));
    }, [debouncedName]); // eslint-disable-line react-hooks/exhaustive-deps

    async function onSubmit(data: FormType) {
        if (!dbName || !schema_) return;
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema:  schema_,
                    value: graphQlUtils.buildGenericUpdateValue({
                        tableName: "product",
                        xData: { id: product.id, name: data.name },
                    }),
                },
            });
            toast.success("Product updated successfully.");
            onSuccess();
            onOpenChange(false);
        } catch {
            toast.error("Failed to update product. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }

    const submitDisabled = checkingName || nameTaken === true || Object.keys(errors).length > 0 || submitting;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined} className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-foreground">
                        Edit Product
                    </DialogTitle>
                </DialogHeader>

                <form className="flex flex-col gap-4 pt-1" onSubmit={form.handleSubmit(onSubmit)}>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="ep_name">
                            Name <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                            <Input
                                autoComplete="off"
                                className="pr-8 font-mono uppercase"
                                id="ep_name"
                                placeholder="e.g. LAPTOP, MOBILE"
                                {...form.register("name")}
                            />
                            {checkingName && (
                                <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                            )}
                            {!checkingName && nameTaken === false && !errors.name && (
                                <Check className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                            )}
                        </div>
                        <FieldError message={errors.name?.message} />
                    </div>

                    <DialogFooter className="pt-2">
                        <Button disabled={submitting} type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button
                            className="bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
                            disabled={submitDisabled}
                            type="submit"
                        >
                            {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
