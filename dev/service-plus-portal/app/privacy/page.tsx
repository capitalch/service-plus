import type { Metadata } from "next";

import { LegalDocument } from "@/components/layout/legal-document";
import { privacy } from "@/content/legal";

export const metadata: Metadata = {
	alternates: { canonical: "/privacy/" },
	description: privacy.description,
	title: "Privacy notice",
	openGraph: {
		description: privacy.description,
		title: "Privacy notice | Service+",
		type: "article",
		url: "/privacy/",
	},
};

const PrivacyPage = () => {
	return <LegalDocument page={privacy} />;
};

export default PrivacyPage;
