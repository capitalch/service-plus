import type { Metadata } from "next";

import { LegalDocument } from "@/components/layout/legal-document";
import { terms } from "@/content/legal";

export const metadata: Metadata = {
	alternates: { canonical: "/terms/" },
	description: terms.description,
	title: "Terms of service",
};

const TermsPage = () => {
	return <LegalDocument page={terms} />;
};

export default TermsPage;
