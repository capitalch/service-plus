export type FaqType = {
	answer: string;
	question: string;
};

export const faqs: FaqType[] = [
	{
		answer: "No. The Lite plan is free with no setup fee. Paid plans have a one-time setup fee and a monthly subscription.",
		question: "Do I need to pay to try Service+?",
	},
	{
		answer: "Payment is by bank transfer for now. Once we confirm your account we share the details; online payment is coming soon.",
		question: "How do I pay?",
	},
	{
		answer: "Yes. Tell us through the enquiry form or call us, and we move your business unit to the new plan. Your data stays as it is.",
		question: "Can I upgrade or downgrade later?",
	},
	{
		answer: "A single user account that you can use on as many devices as you like, but only one person should use it. Standard and Enterprise let you add staff with their own logins and roles.",
		question: "What does “1 user” mean?",
	},
	{
		answer: "A business unit is one workshop or company with its own jobs, stock, numbering and reports. Enterprise lets you run up to five of them on a dedicated database.",
		question: "What is a business unit?",
	},
	{
		answer: "Service+ runs in the cloud with daily backups. Enterprise customers get a separate database of their own.",
		question: "Is my data safe?",
	},
	{
		answer: "Usually within one or two business days of payment for Lite, Basic and Standard, and a little longer for Enterprise, since it needs its own database.",
		question: "How soon can I start?",
	},
];
