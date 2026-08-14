import {
  ApiError,
  type Branch,
  type Company,
  type CompanyInfo,
  type CustomerJobs,
  type JobStatus,
  type Part,
  type PartDetail,
  type PartOrderResult,
  type PartsPage,
} from "./types";

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
}

/** Full URL for a stored image path (already includes the leading "uploads/" segment). */
export function imageUrl(path: string): string {
  return `${apiBaseUrl()}/api/images/${path}`;
}

function extractErrorMessage(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (Array.isArray(detail)) return detail.join("; ");
  if (typeof detail === "string") return detail;
  return fallback;
}

async function publicPost<T>(path: string, body: unknown): Promise<T> {
  const websiteKey = process.env.NEXT_PUBLIC_WEBSITE_KEY ?? "";
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Website-Key": websiteKey },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const responseBody = await response.json().catch(() => null);
    throw new ApiError(extractErrorMessage(responseBody, response.statusText), response.status);
  }

  return response.json() as Promise<T>;
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
  status_code: string;
  status_description: string | null;
  device_details: string | null;
  serial_no: string | null;
}

function mapJobStatus(data: JobStatusApiResponse): JobStatus {
  return {
    jobNo: data.job_no,
    jobDate: data.job_date,
    deliveryDate: data.delivery_date,
    isClosed: data.is_closed,
    status: data.status,
    statusCode: data.status_code,
    statusDescription: data.status_description,
    deviceDetails: data.device_details,
    serialNo: data.serial_no,
  };
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

  return mapJobStatus(data);
}

interface CustomerJobsApiResponse {
  customer_name: string;
  jobs: JobStatusApiResponse[];
}

export async function fetchOpenJobsByMobile(params: {
  company: string;
  mobile: string;
}): Promise<CustomerJobs> {
  const data = await publicGet<CustomerJobsApiResponse>("/api/public/open-jobs", {
    company: params.company,
    mobile: params.mobile,
  });

  return {
    customerName: data.customer_name,
    jobs: data.jobs.map(mapJobStatus),
  };
}

interface BranchApiResponse {
  code: string;
  name: string;
  city: string | null;
  is_head_office: boolean;
}

function mapBranch(data: BranchApiResponse): Branch {
  return {
    code: data.code,
    name: data.name,
    city: data.city,
    isHeadOffice: data.is_head_office,
  };
}

export async function fetchBranches(company: string): Promise<Branch[]> {
  const data = await publicGet<BranchApiResponse[]>("/api/public/branches", { company });
  return data.map(mapBranch);
}

interface CompanyInfoApiResponse {
  support_phone: string | null;
  branch_name: string;
}

export async function fetchCompanyInfo(params: {
  company: string;
  branch: string;
}): Promise<CompanyInfo> {
  const data = await publicGet<CompanyInfoApiResponse>("/api/public/company-info", {
    company: params.company,
    branch: params.branch,
  });

  return { supportPhone: data.support_phone, branchName: data.branch_name };
}

interface PartApiResponse {
  id: number;
  part_name: string;
  part_description: string | null;
  price: number;
  model: string | null;
  image_url: string | null;
}

function mapPart(data: PartApiResponse): Part {
  return {
    id: data.id,
    partName: data.part_name,
    partDescription: data.part_description,
    price: data.price,
    model: data.model,
    imageUrl: data.image_url,
  };
}

interface PartsListApiResponse {
  items: PartApiResponse[];
  total: number;
  page: number;
  page_size: number;
}

export async function fetchParts(params: {
  company: string;
  branch: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<PartsPage> {
  const data = await publicGet<PartsListApiResponse>("/api/public/parts", {
    company: params.company,
    branch: params.branch,
    search: params.search ?? "",
    page: String(params.page ?? 1),
    page_size: String(params.pageSize ?? 20),
  });

  return {
    items: data.items.map(mapPart),
    total: data.total,
    page: data.page,
    pageSize: data.page_size,
  };
}

interface PartDetailApiResponse extends PartApiResponse {
  images: string[];
}

export async function fetchPartById(params: {
  company: string;
  branch: string;
  partId: number;
}): Promise<PartDetail> {
  const data = await publicGet<PartDetailApiResponse>(`/api/public/parts/${params.partId}`, {
    company: params.company,
    branch: params.branch,
  });

  return { ...mapPart(data), images: data.images };
}

interface PartOrderApiResponse {
  order_id: number;
  status: string;
}

export async function submitPartOrder(params: {
  company: string;
  branch: string;
  customerName: string;
  mobile: string;
  email?: string;
  remarks?: string;
  lines: { partId: number; qty: number }[];
}): Promise<PartOrderResult> {
  const data = await publicPost<PartOrderApiResponse>("/api/public/part-orders", {
    company: params.company,
    branch: params.branch,
    customer_name: params.customerName,
    mobile: params.mobile,
    email: params.email || null,
    remarks: params.remarks || null,
    lines: params.lines.map((line) => ({ part_id: line.partId, qty: line.qty })),
  });

  return { orderId: data.order_id, status: data.status };
}
