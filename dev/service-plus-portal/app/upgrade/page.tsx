import type { Metadata } from "next";

import { PageHero } from "@/components/layout/page-hero";
import { UpgradeForm } from "@/components/signup/upgrade-form";
import { MESSAGES } from "@/constants/messages";

export const metadata: Metadata = {
	alternates: { canonical: "/upgrade/" },
	description: "Move your free Service+ Lite business unit to the Basic or Standard plan.",
	title: "Upgrade your Lite plan",
	openGraph: {
		description: "Move your free Service+ Lite business unit to the Basic or Standard plan.",
		title: "Upgrade your Lite plan | Service+",
		type: "website",
		url: "/upgrade/",
	},
};

// A static page: the request runs in the browser against POST /api/public/upgrade/otp and /upgrade.
const UpgradePage = () => {
	return (
		<>
			<PageHero eyebrow="Upgrade" intro={MESSAGES.upgradeIntro} title={MESSAGES.upgradeTitle} />
			<section className="mx-auto w-full max-w-xl px-page pb-section lg:px-page-lg lg:pb-section-lg">
				<div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-8">
					<UpgradeForm />
				</div>
			</section>
		</>
	);
};

export default UpgradePage;
