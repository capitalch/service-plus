import { getApiBaseUrl } from "./utils";
import type { JobFileRow } from "@/features/client/types/job";
import { getAuthItem } from "@/lib/auth-storage";
import { refreshIfNeeded } from "@/lib/token-refresh";

function getAuthHeaders(): Record<string, string> {
    const token = getAuthItem("accessToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function uploadJobFile(
    dbName: string,
    schema: string,
    jobId: number,
    jobNo: string,
    about: string,
    file: File,
    clientCode: string,
    buCode: string,
    branchCode: string,
): Promise<JobFileRow> {
    const token = await refreshIfNeeded();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    const form = new FormData();
    form.append("db_name", dbName);
    form.append("schema", schema);
    form.append("job_id", String(jobId));
    form.append("job_no", jobNo);
    form.append("about", about);
    form.append("files", file);
    form.append("client_code", clientCode);
    form.append("bu_code", buCode);
    form.append("branch_code", branchCode);

    const res = await fetch(`${getApiBaseUrl()}/api/images/upload`, {
        method: "POST",
        headers: headers as HeadersInit,
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
    await refreshIfNeeded();

    const res = await fetch(`${getApiBaseUrl()}/api/images/${dbName}/${schema}/${imageId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
    });

    if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
            throw new Error("Session expired. Please logout and login again.");
        }
        const err = await res.json().catch(() => ({ detail: "Delete failed" }));
        throw new Error(err.detail || "Delete failed");
    }
}

export async function deleteJobFiles(
    dbName: string,
    schema: string,
    jobId: number,
): Promise<void> {
    await refreshIfNeeded();

    const res = await fetch(`${getApiBaseUrl()}/api/images/${dbName}/${schema}/job/${jobId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
    });

    if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
            throw new Error("Session expired. Please logout and login again.");
        }
        const err = await res.json().catch(() => ({ detail: "Delete files failed" }));
        throw new Error(err.detail || "Delete files failed");
    }
}

export async function uploadSparePartWebImages(
    dbName: string,
    schema: string,
    sparePartWebId: number,
    clientCode: string,
    buCode: string,
    files: File[],
): Promise<string[]> {
    const token = await refreshIfNeeded();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    const form = new FormData();
    form.append("db_name", dbName);
    form.append("schema", schema);
    form.append("spare_part_web_id", String(sparePartWebId));
    form.append("client_code", clientCode);
    form.append("bu_code", buCode);
    files.forEach(file => form.append("files", file));

    const res = await fetch(`${getApiBaseUrl()}/api/images/spare-part-web/upload`, {
        method: "POST",
        headers: headers as HeadersInit,
        body: form,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Upload failed" }));
        throw new Error(err.detail || "Upload failed");
    }

    const data: { image_urls: string[] } = await res.json();
    return data.image_urls;
}

export async function deleteSparePartWebImage(
    dbName: string,
    schema: string,
    sparePartWebId: number,
    url: string,
): Promise<string[]> {
    await refreshIfNeeded();

    const res = await fetch(`${getApiBaseUrl()}/api/images/spare-part-web/${dbName}/${schema}/${sparePartWebId}/image`, {
        method: "DELETE",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
    });

    if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
            throw new Error("Session expired. Please logout and login again.");
        }
        const err = await res.json().catch(() => ({ detail: "Delete failed" }));
        throw new Error(err.detail || "Delete failed");
    }

    const data: { image_urls: string[] } = await res.json();
    return data.image_urls;
}

export async function reorderSparePartWebImages(
    dbName: string,
    schema: string,
    sparePartWebId: number,
    imageUrls: string[],
): Promise<string[]> {
    await refreshIfNeeded();

    const res = await fetch(`${getApiBaseUrl()}/api/images/spare-part-web/${dbName}/${schema}/${sparePartWebId}/order`, {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ image_urls: imageUrls }),
    });

    if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
            throw new Error("Session expired. Please logout and login again.");
        }
        const err = await res.json().catch(() => ({ detail: "Reorder failed" }));
        throw new Error(err.detail || "Reorder failed");
    }

    const data: { image_urls: string[] } = await res.json();
    return data.image_urls;
}

export async function deleteSparePartWebPartImages(
    dbName: string,
    schema: string,
    sparePartWebId: number,
    clientCode: string,
    buCode: string,
): Promise<void> {
    await refreshIfNeeded();

    const params = new URLSearchParams({ client_code: clientCode, bu_code: buCode });
    const res = await fetch(`${getApiBaseUrl()}/api/images/spare-part-web/${dbName}/${schema}/part/${sparePartWebId}?${params}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
    });

    if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
            throw new Error("Session expired. Please logout and login again.");
        }
        const err = await res.json().catch(() => ({ detail: "Delete images failed" }));
        throw new Error(err.detail || "Delete images failed");
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
