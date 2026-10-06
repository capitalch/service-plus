import type { Route } from "next";

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

// TODO(real): replace every placeholder below with the real business details before going live.
export const siteConfig = {
	address: {
		city: "Kolkata",
		country: "India",
		line1: "Address line 1",
		line2: "Address line 2",
		mapUrl: "https://maps.google.com/?q=Kolkata",
		pincode: "700001",
		state: "West Bengal",
	},
	appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://serviceplus.cloudjiffy.net",
	// null until real account details are supplied; the enquiry success card then says details come by phone.
	bank: null as BankDetailsType | null,
	businessHours: "Mon–Sat, 10:00 AM – 7:00 PM IST",
	company: "Kush Infotech",
	description:
		"Service+ is cloud software for electronics repair workshops and service centres: job cards, technicians, spare parts, GST invoicing, WhatsApp updates and reports.",
	email: "info@kushinfotech.in",
	name: "Service+",
	phone: "+91 98765 43210",
	/** E.164 for tel: links and structured data. */
	phoneE164: "+919876543210",
	url: "https://myserviceplus.in",
	/** Digits only, country code first, for wa.me links. */
	whatsapp: "919876543210",
};

export const navItems: NavItemType[] = [
	{ href: "/", label: "Home" },
	{ href: "/features", label: "Features" },
	{ href: "/workflow", label: "Workflow" },
	{ href: "/pricing", label: "Pricing" },
	{ href: "/contact", label: "Contact" },
];
