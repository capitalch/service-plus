import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ContactCards } from "@/components/contact/contact-cards";
import { SectionHeading } from "@/components/layout/section-heading";
import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";

export const metadata: Metadata = {
	alternates: { canonical: "/contact/" },
	description: "Call, WhatsApp or email the Service+ team, or visit our office.",
	title: "Contact us",
};

const ContactPage = () => {
	return (
		<section className="bg-grid">
			<div className="mx-auto w-full max-w-6xl px-4 py-14 sm:py-20 lg:px-6">
				<SectionHeading eyebrow="Contact" intro={MESSAGES.contactIntro} title={MESSAGES.contactTitle} />
				<div className="mt-12">
					<ContactCards />
				</div>
				<div className="mt-12 text-center">
					<Button asChild size="lg">
						<Link href="/pricing">
							Choose a plan
							<ArrowRight />
						</Link>
					</Button>
				</div>
			</div>
		</section>
	);
};

export default ContactPage;
