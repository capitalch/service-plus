import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import type { JobDeliveryFullDetail } from "./deliver-job-schema";
import type { DeliveryNoteJobInfo } from "./deliver-job-pdf";

type GenericQueryData<T> = { genericQuery: T[] | null };

// Fetches full detail (address, invoice, receipts) for one or more jobs in a
// single batched query and maps it straight to DeliveryNoteJobInfo.
// GET_DELIVERABLE_JOBS_DETAIL_MULTI has no status filter, so it works equally
// well for already-delivered jobs as for the live delivery flow. Shared by
// both the Deliver Job "Delivered Jobs" tab and Batch Warranty Jobs.
export async function fetchDeliveryNoteJobsByIds(
    dbName: string | null,
    schema: string | null,
    jobIds: number[],
): Promise<DeliveryNoteJobInfo[]> {
    if (!dbName || !schema || jobIds.length === 0) return [];
    const res = await apolloClient.query<GenericQueryData<JobDeliveryFullDetail>>({
        fetchPolicy: "network-only",
        query: GRAPHQL_MAP.genericQuery,
        variables: {
            db_name: dbName, schema,
            value: graphQlUtils.buildGenericQueryValue({
                sqlId:   SQL_MAP.GET_DELIVERABLE_JOBS_DETAIL_MULTI,
                sqlArgs: { job_ids: jobIds },
            }),
        },
    });
    const details = res.data?.genericQuery ?? [];
    return details.map(job => ({
        customer_contact_id:    job.customer_contact_id,
        job_no:                 job.job_no,
        alternate_job_no:       job.alternate_job_no ?? null,
        job_date:               job.job_date,
        customer_name:          job.customer_name ?? "",
        mobile:                 job.mobile,
        customer_address_line1: job.customer_address_line1,
        customer_address_line2: job.customer_address_line2,
        customer_landmark:      job.customer_landmark,
        customer_city:          job.customer_city,
        customer_postal_code:   job.customer_postal_code,
        customer_state:         job.customer_state,
        device_details:         job.device_details,
        technician_name:        job.technician_name,
        amount:                 job.amount,
        invoice_no:             job.invoice_no ?? null,
        receipt_nos:            job.payments.map(p => p.receipt_no).filter((r): r is string => !!r),
        delivery_ok:            job.job_status_code !== "DELIVERED_NOT_OK",
        delivery_date:          job.delivery_date ?? "",
        remarks:                job.remarks,
    }));
}
