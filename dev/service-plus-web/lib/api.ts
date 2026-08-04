import { ApiError, type Company, type JobStatus } from "./types";

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
}

async function publicGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${apiBaseUrl()}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const websiteKey = process.env.NEXT_PUBLIC_WEBSITE_KEY ?? "";
  const response = await fetch(url.toString(), {
    headers: { "X-Website-Key": websiteKey },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(body?.detail ?? response.statusText, response.status);
  }

  return response.json() as Promise<T>;
}

export async function fetchCompanies(): Promise<Company[]> {
  return publicGet<Company[]>("/api/public/companies", {});
}

interface JobStatusApiResponse {
  job_no: string;
  job_date: string | null;
  delivery_date: string | null;
  is_closed: boolean;
  status: string;
  device_details: string | null;
  branch_name: string | null;
}

export async function fetchJobStatus(params: {
  company: string;
  jobNo: string;
  mobile: string;
}): Promise<JobStatus> {
  const data = await publicGet<JobStatusApiResponse>("/api/public/job-status", {
    company: params.company,
    job_no: params.jobNo,
    mobile: params.mobile,
  });

  return {
    jobNo: data.job_no,
    jobDate: data.job_date,
    deliveryDate: data.delivery_date,
    isClosed: data.is_closed,
    status: data.status,
    deviceDetails: data.device_details,
    branchName: data.branch_name,
  };
}
