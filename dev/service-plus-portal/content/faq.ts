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
		answer: "No. All prices are exclusive of GST. GST is charged extra at the applicable rate on the setup fee and on every monthly fee.",
		question: "Do the prices include GST?",
	},
	{
		answer: "By bank transfer for now. Pay the one-time setup fee first; your account is created once it is received. After that you pay the monthly fee each month, in advance. If a month goes unpaid, a paid plan becomes view-only — you can still see and print everything, but not add or change anything — until it is paid. Online payment is coming soon.",
		question: "How do I pay?",
	},
	{
		answer: "Yes. You can pay any number of months ahead, or up to 5 years at once, at the same monthly rate — there is no discount for paying in advance. If you change plan later, your prepaid time is adjusted to the new fee.",
		question: "Can I pay in advance?",
	},
	{
		answer: "Yes. Tell us through the enquiry form or call us, and we move your business unit to the new plan. Your data stays as it is. To move to a plan with fewer branches, you first delete the data of your extra branches and the branches themselves.",
		question: "Can I upgrade or downgrade later?",
	},
	{
		answer: "A single user account that you can use on as many devices as you like, but only one person should use it. Standard and Enterprise let you add staff with their own logins and roles.",
		question: "What does “1 user” mean?",
	},
	{
		answer: "A business unit is one workshop or company with its own jobs, stock, numbering and reports. Enterprise includes five of them on a dedicated database, and you can add more for a monthly fee each — see Compare plans.",
		question: "What is a business unit?",
	},
	{
		answer: "Lite, Basic and Standard include one branch, the head office. Enterprise includes multiple branches, which you add and edit yourself.",
		question: "How many branches can I have?",
	},
	{
		answer: "Service+ runs in the cloud with daily backups. Enterprise customers get a separate database of their own.",
		question: "Is my data safe?",
	},
	{
		answer: "Usually within one or two business days of payment for Lite, Basic and Standard, and a little longer for Enterprise, since it needs its own database.",
		question: "How soon can I start?",
	},
	{
		answer: "Ask AI is a helper inside the app's Help. Your staff type a question about using Service+ and get a short answer taken only from the Service+ help guide, with links to the pages it used. It is included in every plan, up to 30 questions a day per business unit. Questions are answered by Google's Gemini AI, so staff should not type customer names or numbers; phone numbers and email addresses are removed before a question is sent.",
		question: "What is Ask AI?",
	},
];
