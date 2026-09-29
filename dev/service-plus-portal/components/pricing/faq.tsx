import { SectionHeading } from "@/components/layout/section-heading";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MESSAGES } from "@/constants/messages";
import { faqs } from "@/content/faq";

export const Faq = () => {
	return (
		<section className="mx-auto w-full max-w-3xl px-page py-section lg:px-page-lg lg:py-section-lg" id="faq">
			<SectionHeading title={MESSAGES.faqTitle} />
			<Accordion className="mt-8 rounded-2xl border border-border bg-card px-5" collapsible type="single">
				{faqs.map((faq) => (
					<AccordionItem key={faq.question} value={faq.question}>
						<AccordionTrigger>{faq.question}</AccordionTrigger>
						<AccordionContent>{faq.answer}</AccordionContent>
					</AccordionItem>
				))}
			</Accordion>
		</section>
	);
};
