import { getApiBaseUrl } from "./utils";
import type { JobFileRow } from "@/features/client/types/job";

function getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem("accessToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function uploadJobFile(
    dbName: string,
    schema: string,
    jobId: number,
    about: string,
    file: File,
): Promise<JobFileRow> {
    const form = new FormData();
    form.append("db_name", dbName);
    form.append("schema", schema);
    form.append("job_id", String(jobId));
    form.append("about", about);
    form.append("files", file);

    const res = await fetch(`${getApiBaseUrl()}/api/images/upload`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: form,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Upload failed" }));
        throw new Error(err.detail || "Upload failed");
    }

    const rows: JobFileRow[] = await res.json();
    return rows[0];
}

export async function deleteJobFile(
    dbName: string,
    schema: string,
    imageId: number,
): Promise<void> {
    const res = await fetch(`${getApiBaseUrl()}/api/images/${dbName}/${schema}/${imageId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Delete failed" }));
        throw new Error(err.detail || "Delete failed");
    }
}

export async function deleteJobFiles(
    dbName: string,
    schema: string,
    jobId: number,
): Promise<void> {
    const res = await fetch(`${getApiBaseUrl()}/api/images/${dbName}/${schema}/job/${jobId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Delete failed" }));
        throw new Error(err.detail || "Delete files failed");
    }
}

export async function getUploadConfig(): Promise<{ upload_max_size_kb: number }> {
    const res = await fetch(`${getApiBaseUrl()}/api/images/config`, {
        headers: getAuthHeaders(),
    });

    if (!res.ok) {
        return { upload_max_size_kb: 500 }; // Default fallback
    }

    return res.json();
}
