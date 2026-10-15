import type { Route } from "next";

import { MESSAGES } from "@/constants/messages";

export type BankDetailsType = {
	accountName: string;
	accountNumber: string;
	bankName: string;
	branch: string;
	ifsc: string;
	upiId?: string;
};

export type NavItemType = {
	href: Route;
	label: string;
};

function optionalEnv(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

function requireEnv(value: string | undefined, name: string): string {
	const trimmed = optionalEnv(value);
	if (!trimmed) throw new Error(`${MESSAGES.envValueMissing} ${name}`);
	return trimmed;
}

function toDigits(value: string): string {
	return value.replace(/\D/g, "");
}

// NEXT_PUBLIC_* values are inlined at build time only when read as literal process.env.NEXT_PUBLIC_X expressions.
const appUrl = (optionalEnv(process.env.NEXT_PUBLIC_APP_URL) ?? "https://serviceplus.cloudjiffy.net").replace(
	/\/$/,
	"",
);
const addressCity = optionalEnv(process.env.NEXT_PUBLIC_ADDRESS_CITY) ?? "Kolkata";
const addressCountry = optionalEnv(process.env.NEXT_PUBLIC_ADDRESS_COUNTRY) ?? "India";
const addressLine1 = optionalEnv(process.env.NEXT_PUBLIC_ADDRESS_LINE1) ?? "";
const addressLine2 = optionalEnv(process.env.NEXT_PUBLIC_ADDRESS_LINE2) ?? "";
const addressPincode = optionalEnv(process.env.NEXT_PUBLIC_ADDRESS_PINCODE) ?? "";
const addressState = optionalEnv(process.env.NEXT_PUBLIC_ADDRESS_STATE) ?? "West Bengal";
const bankAccountNumber = optionalEnv(process.env.NEXT_PUBLIC_BANK_ACCOUNT_NUMBER);
const bankIfsc = optionalEnv(process.env.NEXT_PUBLIC_BANK_IFSC);
const phone = requireEnv(process.env.NEXT_PUBLIC_CONTACT_PHONE, "NEXT_PUBLIC_CONTACT_PHONE");
const whatsappSource = optionalEnv(process.env.NEXT_PUBLIC_CONTACT_WHATSAPP) ?? phone;

export const siteConfig = {
	address: {
		city: addressCity,
		country: addressCountry,
		line1: addressLine1,
		line2: addressLine2,
		mapUrl:
			optionalEnv(process.env.NEXT_PUBLIC_ADDRESS_MAP_URL) ??
			`https://maps.google.com/?q=${encodeURIComponent(
				[addressLine1, addressLine2, addressCity, addressPincode, addressState].filter(Boolean).join(", "),
			)}`,
		pincode: addressPincode,
		state: addressState,
	},
	appUrl,
	// null unless account number and IFSC are set; the enquiry success card then says details come by phone.
	bank: (bankAccountNumber && bankIfsc
		? {
				accountName: optionalEnv(process.env.NEXT_PUBLIC_BANK_ACCOUNT_NAME) ?? "",
				accountNumber: bankAccountNumber,
				bankName: optionalEnv(process.env.NEXT_PUBLIC_BANK_NAME) ?? "",
				branch: optionalEnv(process.env.NEXT_PUBLIC_BANK_BRANCH) ?? "",
				ifsc: bankIfsc,
				upiId: optionalEnv(process.env.NEXT_PUBLIC_BANK_UPI_ID),
			}
		: null) as BankDetailsType | null,
	businessHours: optionalEnv(process.env.NEXT_PUBLIC_BUSINESS_HOURS) ?? "Mon–Sat, 10:00 AM – 7:00 PM IST",
	company: "Kush Infotech",
	// The app's /demo page signs a visitor straight into the read-only demo workshop.
	demoUrl: `${appUrl}/demo`,
	description:
		"Service+ is cloud software for electronics repair workshops and service centres: job cards, technicians, spare parts, GST invoicing, WhatsApp updates and reports.",
	email: requireEnv(process.env.NEXT_PUBLIC_CONTACT_EMAIL, "NEXT_PUBLIC_CONTACT_EMAIL"),
	name: "Service+",
	phone,
	/** E.164 for tel: links and structured data. */
	phoneE164: `+${toDigits(phone)}`,
	url: requireEnv(process.env.NEXT_PUBLIC_SITE_URL, "NEXT_PUBLIC_SITE_URL"),
	/** Digits only, country code first, for wa.me links. */
	whatsapp: toDigits(whatsappSource),
	/** Display form of the WhatsApp number. */
	whatsappDisplay: whatsappSource,
};

export const navItems: NavItemType[] = [
	{ href: "/", label: "Home" },
	{ href: "/features", label: "Features" },
	{ href: "/workflow", label: "Workflow" },
	{ href: "/pricing", label: "Pricing" },
	{ href: "/contact", label: "Contact" },
];
