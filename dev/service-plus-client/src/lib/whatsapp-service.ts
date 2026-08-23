import { getApiBaseUrl } from "./utils";
import { refreshIfNeeded } from "@/lib/token-refresh";
import { MESSAGES } from "@/constants/messages";

/** Gates every WhatsApp button/menu-item across the app. The server send path
 * (plan-whatsapp.md §4) has shipped, so this is on; flip back to false to disable
 * the feature app-wide without touching the individual call sites. */
export const WHATSAPP_FEATURE_ENABLED = true;

// The three PDF-carrying WhatsApp sends — job completion is text-only and goes
// through the sendWhatsappCompletion GraphQL mutation instead (see plan-whatsapp.md §4d/§4e).
export type WhatsappDocumentEventType = "JOB_CREATION" | "JOB_DELIVERY" | "JOB_RECEIPT";

export interface WhatsappSendResult {
    status: "SENT" | "FAILED";
    error: string | null;
}

/** POST a job PDF + trigger the templated WhatsApp send for it. `jobIds` is plural
 * even for a single job — only a batch job-creation send carries more than one. */
export async function sendWhatsappDocument(
    dbName: string,
    schema: string,
    jobIds: number[],
    eventType: WhatsappDocumentEventType,
    pdf: Blob,
    filename: string,
): Promise<WhatsappSendResult> {
    const token = await refreshIfNeeded();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    const form = new FormData();
    form.append("db_name", dbName);
    form.append("schema", schema);
    form.append("event_type", eventType);
    jobIds.forEach(id => form.append("job_ids", String(id)));
    form.append("pdf", pdf, filename);

    const res = await fetch(`${getApiBaseUrl()}/notifications/whatsapp/send`, {
        method: "POST",
        headers: headers as HeadersInit,
        body: form,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: MESSAGES.ERROR_WHATSAPP_SEND_FAILED }));
        throw new Error(err.detail || MESSAGES.ERROR_WHATSAPP_SEND_FAILED);
    }

    return res.json();
}
