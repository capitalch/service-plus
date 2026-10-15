import type { Metadata } from "next";

import { LegalDocument } from "@/components/layout/legal-document";
import { terms } from "@/content/legal";

export const metadata: Metadata = {
	alternates: { canonical: "/terms/" },
	description: terms.description,
	title: "Terms of service",
	openGraph: {
		description: terms.description,
		title: "Terms of service | Service+",
		type: "article",
		url: "/terms/",
	},
};

const TermsPage = () => {
	return <LegalDocument page={terms} />;
};

export default TermsPage;
