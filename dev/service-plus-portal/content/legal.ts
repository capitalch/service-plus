// Plain-language legal copy for the two pages the site is required to carry once it collects
// personal data through the enquiry form. TODO(real): have a lawyer review before going live.

export type LegalSectionType = {
	heading: string;
	items?: string[];
	body?: string;
};

export type LegalPageType = {
	description: string;
	intro: string;
	sections: LegalSectionType[];
	title: string;
	updated: string;
};

const COMPANY = "Kush Infotech";

export const privacy: LegalPageType = {
	description:
		"How Service+ collects, uses and stores the personal information you send through this website, including enquiries, phone calls, WhatsApp messages and email.",
	intro: "This notice explains what happens to the details you give us through this website. It covers the enquiry form, phone calls, WhatsApp messages and email — not the data inside the Service+ application itself, which is covered by the agreement you sign with us as a customer.",
	sections: [
		{
			heading: "What we collect",
			items: [
				"Details you type into the enquiry form: your name, business name, mobile number, email address, city, GSTIN if you give one, the number of branches you need, and any message you write.",
				"The plan you select on the form.",
				"Basic technical records our servers keep automatically, such as your IP address and the time the enquiry arrived, which we use to block automated spam.",
			],
		},
		{
			heading: "Why we collect it",
			body: "We use your details only to answer your enquiry: to call you back, to understand the size of your workshop, to recommend the right plan, and to set up your account if you decide to subscribe. We do not sell your details, and we do not use them for third-party advertising.",
		},
		{
			heading: "Who can see them",
			body: `Your details stay inside ${COMPANY}. Our staff who handle enquiries and account setup can see them. We do not share them with third parties, except where a service provider we use to run our business (for example our email or hosting provider) needs them to deliver that service to us.`,
		},
		{
			heading: "How long we keep them",
			body: "We keep enquiries that do not become subscriptions for up to 24 months, so we can pick up a conversation where it left off. If you become a customer, your contact details are kept for as long as your account is active and for the period afterwards needed to meet tax and record-keeping obligations.",
		},
		{
			heading: "Where your data is stored",
			body: "Our website and application run on cloud infrastructure in India. Your enquiry details are stored there and are not transferred outside India.",
		},
		{
			heading: "Your rights",
			body: `You can ask us to show you the personal details we hold about you, correct anything wrong, or delete them. You can also withdraw your consent at any time, which stops us contacting you about an enquiry. Write to us at the email address on our contact page and we will respond within 30 days. You may also complain to the Data Protection Board of India if you are not satisfied with our response.`,
		},
		{
			heading: "Cookies",
			body: "This website stores one preference in your browser: whether you chose the light or dark theme. It is not used to track you, and there are no advertising or analytics cookies. If this site later gains analytics cookies, this notice will say so and ask for consent before they are set.",
		},
		{
			heading: "Changes to this notice",
			body: "If we change how we handle your details, we will update this page and change the date at the top. We will contact you directly if a change affects information you have already given us.",
		},
	],
	title: "Privacy notice",
	updated: "1 September 2026",
};

export const terms: LegalPageType = {
	description:
		"The terms that apply to your use of the Service+ marketing website, the trial and paid subscriptions, and the software Service+ itself.",
	intro: `These terms cover your use of this website and, once you subscribe, your use of the Service+ software. The Service+ software is operated by ${COMPANY}.`,
	sections: [
		{
			heading: "Using this website",
			body: "You may browse this site, read the material on it and download the enquiry form. You may not copy or republish the content, or use the site to send unsolicited commercial messages.",
		},
		{
			heading: "Plans, prices and limits",
			items: [
				"The Lite plan is free and carries no setup fee. Paid plans are billed monthly in advance, plus a one-time setup fee.",
				"Job, WhatsApp message and business unit limits are counted per business unit, per calendar month.",
				"Plans can be changed on request. Upgrades take effect from the next billing cycle; we agree any credit or top-up for a mid-cycle change with you first.",
			],
		},
		{
			heading: "Free trial and the Lite plan",
			body: "No card details are needed. We may limit or withdraw the free plan, and may ask a long-standing free account to move to a paid plan, giving reasonable notice first.",
		},
		{
			heading: "Payment and cancellation",
			body: "Payment is currently by bank transfer; the details are shared once we confirm your account. Subscriptions renew monthly until cancelled. Cancel by telling us, and your plan runs to the end of the month you paid for. We do not charge a cancellation fee, and we do not refund a month that has already started.",
		},
		{
			heading: "Your account and staff",
			body: "You are responsible for the accuracy of the information you enter, for the GSTIN and tax details you print on your invoices, and for keeping your login credentials safe. Each member of staff should have their own login so you can see who did what.",
		},
		{
			heading: "Acceptable use",
			body: "You may not use Service+ to send unlawful material, to infringe anyone else's rights, or to attempt to gain unauthorised access to the service or another customer's data. We may suspend an account that does this.",
		},
		{
			heading: "Availability and data",
			body: "We aim for continuous availability and back up your data daily. We do not promise the service will never be unavailable. We are not liable for indirect or consequential loss, such as lost profit, and our total liability in any twelve-month period is limited to the amount you paid us in that period.",
		},
		{
			heading: "Intellectual property",
			body: `Service+, its name and its screens belong to ${COMPANY} or its licensors. These terms do not transfer any of that ownership to you. You may not resell, rebrand or redistribute the software.`,
		},
		{
			heading: "Ending the agreement",
			body: "Either of us may end this agreement if the other breaks it and does not fix the break within 30 days of being told about it. On ending, you stop using the service and pay any amount already due. You can export your data before your plan ends.",
		},
		{
			heading: "Governing law",
			body: `These terms are governed by the laws of India, and the courts of Kolkata, West Bengal have exclusive jurisdiction over any dispute.`,
		},
		{
			heading: "Changes to these terms",
			body: "We may update these terms. If a change materially affects you, we will tell you before it takes effect. Continuing to use the service after that means you accept the updated terms.",
		},
	],
	title: "Terms of service",
	updated: "1 September 2026",
};
