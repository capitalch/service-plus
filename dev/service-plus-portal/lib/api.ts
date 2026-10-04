import type { PlanCodeType } from "@/content/pricing";

export class ApiError extends Error {
	/** The server's refusal code (e.g. SIGNUP_DUPLICATE, DEFAULT_DB_NOT_CONFIGURED), when it sent one. */
	code: string | null;
	status: number;

	constructor(message: string, status: number, code: string | null = null) {
		super(message);
		this.code = code;
		this.name = "ApiError";
		this.status = status;
	}
}

export type SalesEnquiryType = {
	businessName: string;
	city: string;
	email: string;
	gstin: string;
	message: string;
	mobile: string;
	name: string;
	plan: PlanCodeType;
};

export type PlanPricesResponseType = {
	enterprise_included_bus: number;
	extra_bu_monthly_fee: number;
	plans: { monthly_fee: number; plan_code: string; setup_fee: number }[];
};

export type SignupStatusType = {
	client_name: string | null;
	login_email: string | null;
	plan_code: PlanCodeType;
	rejection_reason: string | null;
	status: "approved" | "pending" | "rejected";
};

function apiBaseUrl(): string {
	return process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
}

function websiteHeaders(): Record<string, string> {
	return { "X-Website-Key": process.env.NEXT_PUBLIC_WEBSITE_KEY ?? "" };
}

// FastAPI sends `detail` as a string, a list (validation errors) or, for sign-up refusals,
// {code, message}.
function readError(body: unknown, fallback: string): { code: string | null; message: string } {
	const detail = (body as { detail?: unknown } | null)?.detail;
	if (Array.isArray(detail))
		return { code: null, message: detail.map((d) => (typeof d === "string" ? d : JSON.stringify(d))).join("; ") };
	if (typeof detail === "string") return { code: null, message: detail };
	if (detail && typeof detail === "object") {
		const { code, message } = detail as { code?: unknown; message?: unknown };
		return {
			code: typeof code === "string" ? code : null,
			message: typeof message === "string" ? message : fallback,
		};
	}
	return { code: null, message: fallback };
}

async function publicRequest<T>(path: string, init: RequestInit): Promise<T> {
	const response = await fetch(`${apiBaseUrl()}${path}`, init);

	if (!response.ok) {
		const responseBody = await response.json().catch(() => null);
		const { code, message } = readError(responseBody, response.statusText);
		throw new ApiError(message, response.status, code);
	}

	return response.json() as Promise<T>;
}

function publicPost<T>(path: string, body: unknown): Promise<T> {
	return publicRequest<T>(path, {
		body: JSON.stringify(body),
		headers: { "Content-Type": "application/json", ...websiteHeaders() },
		method: "POST",
	});
}

function enquiryBody(enquiry: SalesEnquiryType) {
	return {
		business_name: enquiry.businessName,
		city: enquiry.city,
		email: enquiry.email,
		gstin: enquiry.gstin || null,
		message: enquiry.message || null,
		mobile: enquiry.mobile,
		name: enquiry.name,
		plan_code: enquiry.plan,
	};
}

/** Enterprise enquiry. Returns the reference shown on the success screen. */
export async function submitSalesEnquiry(enquiry: SalesEnquiryType): Promise<string> {
	const result = await publicPost<{ reference: string; status: string }>(
		"/api/public/sales-enquiry",
		enquiryBody(enquiry),
	);
	return result.reference;
}

/** Lite / Basic / Standard sign-up. Returns the reference shown on the success screen. */
export async function submitSignup(enquiry: SalesEnquiryType): Promise<string> {
	const result = await publicPost<{ reference: string; status: string }>("/api/public/signup", enquiryBody(enquiry));
	return result.reference;
}

/** A sign-up's status; mobile and email must match the same request (404 otherwise). */
export function fetchSignupStatus(mobile: string, email: string): Promise<SignupStatusType> {
	return publicPost<SignupStatusType>("/api/public/signup/status", { email, mobile });
}

/** The live price list from the server's .env, in whole rupees. */
export function fetchPlanPrices(): Promise<PlanPricesResponseType> {
	return publicRequest<PlanPricesResponseType>("/api/public/plan-prices", { headers: websiteHeaders() });
}
