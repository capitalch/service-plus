import type { Metadata } from "next";

import { LegalDocument } from "@/components/layout/legal-document";
import { privacy } from "@/content/legal";

export const metadata: Metadata = {
	alternates: { canonical: "/privacy/" },
	description: privacy.description,
	title: "Privacy notice",
};

const PrivacyPage = () => {
	return <LegalDocument page={privacy} />;
};

export default PrivacyPage;
