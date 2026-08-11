import { useState } from "react";
import { toast } from "sonner";
import { isValidMobile } from "@/lib/mobile";
import { sendWhatsappDocument, type WhatsappDocumentEventType } from "@/lib/whatsapp-service";
import { MESSAGES } from "@/constants/messages";

interface SendWhatsappArgs {
    dbName: string;
    schema: string;
    jobIds: number[];
    eventType: WhatsappDocumentEventType;
    pdf: Blob;
    filename: string;
}

/** Shared in-flight state + toast/error handling for the "Whatsapp" buttons
 * (job creation/delivery/receipt — plan-whatsapp.md §5). Each caller still
 * builds its own PDF Blob first (job sheet vs invoice vs receipt differ) and
 * passes it in; `key` lets a grid track per-row spinners instead of one flag
 * for the whole screen. */
export function useWhatsappSend() {
    const [sendingKey, setSendingKey] = useState<string | number | null>(null);

    const sendWhatsapp = async (
        key: string | number,
        mobile: string | null | undefined,
        args: SendWhatsappArgs,
    ): Promise<void> => {
        if (!isValidMobile(mobile)) {
            toast.error(MESSAGES.INFO_WHATSAPP_NO_MOBILE);
            return;
        }
        setSendingKey(key);
        try {
            const result = await sendWhatsappDocument(
                args.dbName, args.schema, args.jobIds, args.eventType, args.pdf, args.filename,
            );
            if (result.status === "SENT") {
                toast.success(MESSAGES.SUCCESS_WHATSAPP_SENT);
            } else {
                toast.error(result.error || MESSAGES.ERROR_WHATSAPP_SEND_FAILED);
            }
        } catch (err) {
            toast.error((err as Error).message || MESSAGES.ERROR_WHATSAPP_SEND_FAILED);
        } finally {
            setSendingKey(null);
        }
    };

    return {
        isSendingWhatsapp: (key: string | number) => sendingKey === key,
        sendWhatsapp,
    };
}
