import type { Metadata } from "next";

import { PageHero } from "@/components/layout/page-hero";
import { SignupStatusForm } from "@/components/signup/signup-status-form";
import { MESSAGES } from "@/constants/messages";

export const metadata: Metadata = {
	alternates: { canonical: "/signup-status/" },
	description: "Check the progress of your Service+ sign-up with your mobile number and email.",
	title: "Sign-up status",
};

// A static page: the lookup runs in the browser against POST /api/public/signup/status.
const SignupStatusPage = () => {
	return (
		<>
			<PageHero eyebrow="Sign-up" intro={MESSAGES.statusIntro} title={MESSAGES.statusTitle} />
			<section className="mx-auto w-full max-w-xl px-page pb-section lg:px-page-lg lg:pb-section-lg">
				<div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-8">
					<SignupStatusForm />
				</div>
			</section>
		</>
	);
};

export default SignupStatusPage;
