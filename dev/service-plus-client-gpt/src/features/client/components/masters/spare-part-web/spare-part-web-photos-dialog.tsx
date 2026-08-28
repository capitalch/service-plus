import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { EntityImageUpload } from "@/components/shared/entity-image-upload";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import {
    deleteSparePartWebImage,
    reorderSparePartWebImages,
    uploadSparePartWebImages,
} from "@/lib/image-service";
import { useAppSelector } from "@/store/hooks";
import { selectClientCode, selectDbName } from "@/features/auth/store/auth-slice";
import { selectCurrentBu, selectSchema } from "@/store/context-slice";
import type { SparePartWebType } from "@/features/client/types/spare-part-web";

type GenericQueryDataType<T> = { genericQuery: T[] | null };

export type SparePartWebPhotosDialogProps = {
    onOpenChange: (open: boolean) => void;
    onSuccess:    () => void;
    open:         boolean;
    part:         SparePartWebType;
};

export const SparePartWebPhotosDialog = ({ onOpenChange, onSuccess, open, part }: SparePartWebPhotosDialogProps) => {
    const dbName    = useAppSelector(selectDbName);
    const schema_   = useAppSelector(selectSchema);
    const currentBu = useAppSelector(selectCurrentBu);
    const clientCode = useAppSelector(selectClientCode) ?? "";
    const buCode      = currentBu?.code ?? "";

    const [images,  setImages]  = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open || !dbName || !schema_) return;
        setLoading(true);
        apolloClient
            .query<GenericQueryDataType<{ image_urls: string[] }>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema:  schema_,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { id: part.id },
                        sqlId:   SQL_MAP.GET_SPARE_PART_WEB_IMAGE_CONTEXT,
                    }),
                },
            })
            .then(res => setImages(res.data?.genericQuery?.[0]?.image_urls ?? []))
            .catch(() => setImages([]))
            .finally(() => setLoading(false));
    }, [open, dbName, schema_, part.id]);

    function handleChange(urls: string[]) {
        setImages(urls);
        onSuccess();
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                onCloseAutoFocus={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
                aria-describedby={undefined}
                className="sm:max-w-lg max-h-[90vh] overflow-y-auto"
            >
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-foreground">
                        Photos — {part.part_name}
                    </DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex h-24 items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-(--cl-text-muted)" />
                    </div>
                ) : (
                    <EntityImageUpload
                        deleteImage={url => deleteSparePartWebImage(dbName!, schema_!, part.id, url)}
                        images={images}
                        reorderImages={urls => reorderSparePartWebImages(dbName!, schema_!, part.id, urls)}
                        uploadFiles={files => uploadSparePartWebImages(dbName!, schema_!, part.id, clientCode, buCode, files)}
                        onChange={handleChange}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
};
