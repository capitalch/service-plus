import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ContactCards } from "@/components/contact/contact-cards";
import { ContactEnquiryForm } from "@/components/contact/contact-enquiry-form";
import { PageHero } from "@/components/layout/page-hero";
import { SectionHeading } from "@/components/layout/section-heading";
import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";

export const metadata: Metadata = {
	alternates: { canonical: "/contact/" },
	description: "Call, WhatsApp or email the Service+ team, send an enquiry, or visit our office.",
	title: "Contact us",
};

const ContactPage = () => {
	return (
		<>
			<PageHero eyebrow="Contact" intro={MESSAGES.contactIntro} title={MESSAGES.contactTitle}>
				<div className="mt-12">
					<ContactCards />
				</div>
			</PageHero>

			{/* The page used to be cards only, so a visitor who wanted to get in touch had nothing
			    to fill in. Same form and same endpoint as /pricing, no backend change needed. */}
			<section
				className="mx-auto w-full max-w-3xl scroll-mt-24 px-page pb-section lg:px-page-lg lg:pb-section-lg"
				id="enquire"
			>
				<SectionHeading eyebrow="Enquiry" intro={MESSAGES.contactFormIntro} title={MESSAGES.enquiryTitle} />
				<div className="mt-10">
					<ContactEnquiryForm />
				</div>
				<div className="mt-10 text-center">
					<Button asChild size="lg" variant="outline">
						<Link href="/pricing">
							See the full plan details
							<ArrowRight />
						</Link>
					</Button>
				</div>
			</section>
		</>
	);
};

export default ContactPage;
