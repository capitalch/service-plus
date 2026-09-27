import type { PlanCodeType } from "@/content/pricing";

export class ApiError extends Error {
	status: number;

	constructor(message: string, status: number) {
		super(message);
		this.name = "ApiError";
		this.status = status;
	}
}

export type SalesEnquiryType = {
	branches: number;
	businessName: string;
	city: string;
	email: string;
	gstin: string;
	message: string;
	mobile: string;
	name: string;
	plan: PlanCodeType;
};

function apiBaseUrl(): string {
	return process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
}

function extractErrorMessage(body: unknown, fallback: string): string {
	const detail = (body as { detail?: unknown } | null)?.detail;
	if (Array.isArray(detail)) return detail.map((d) => (typeof d === "string" ? d : JSON.stringify(d))).join("; ");
	if (typeof detail === "string") return detail;
	return fallback;
}

async function publicPost<T>(path: string, body: unknown): Promise<T> {
	const response = await fetch(`${apiBaseUrl()}${path}`, {
		body: JSON.stringify(body),
		headers: { "Content-Type": "application/json", "X-Website-Key": process.env.NEXT_PUBLIC_WEBSITE_KEY ?? "" },
		method: "POST",
	});

	if (!response.ok) {
		const responseBody = await response.json().catch(() => null);
		throw new ApiError(extractErrorMessage(responseBody, response.statusText), response.status);
	}

	return response.json() as Promise<T>;
}

export async function submitSalesEnquiry(enquiry: SalesEnquiryType): Promise<void> {
	await publicPost<{ status: string }>("/api/public/sales-enquiry", {
		branches: enquiry.branches,
		business_name: enquiry.businessName,
		city: enquiry.city,
		email: enquiry.email,
		gstin: enquiry.gstin || null,
		message: enquiry.message || null,
		mobile: enquiry.mobile,
		name: enquiry.name,
		plan_code: enquiry.plan,
	});
}
