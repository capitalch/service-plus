import { isValidMobile } from "@/lib/mobile";
import type { CustomerConnectJobRow, CustomerGroup, WhatsappCompletionState } from "./customer-connect-schema";

export const PAGE_SIZE = 50;

export function isRowSelectable(row: CustomerConnectJobRow): boolean {
    return isValidMobile(row.mobile);
}

export function getCompletionState(row: CustomerConnectJobRow): WhatsappCompletionState | null {
    return row.whatsapp_notifications?.JOB_COMPLETION ?? null;
}

export type GroupableJobRow = Pick<CustomerConnectJobRow, "id" | "job_no" | "amount" | "customer_contact_id" | "customer_name" | "mobile">;

// Groups by customer_contact_id — one WhatsApp message per customer, never one
// per job. Mirrors the grouping the sendWhatsappCompletion resolver itself does
// server-side, so "N jobs · M customers" in the toolbar/modal is trustworthy
// before the click, not just after the server re-groups it.
export function groupRowsByCustomer(rows: GroupableJobRow[]): CustomerGroup[] {
    const groups = new Map<number, CustomerGroup>();
    for (const row of rows) {
        let group = groups.get(row.customer_contact_id);
        if (!group) {
            group = {
                customer_contact_id: row.customer_contact_id,
                customer_name: row.customer_name,
                mobile: row.mobile,
                job_ids: [],
                job_nos: [],
                amount: 0,
            };
            groups.set(row.customer_contact_id, group);
        }
        group.job_ids.push(row.id);
        group.job_nos.push(row.job_no);
        group.amount += row.amount ?? 0;
    }
    return [...groups.values()];
}
