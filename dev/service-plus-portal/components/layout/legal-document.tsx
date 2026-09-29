import Link from "next/link";

import { PageHero } from "@/components/layout/page-hero";
import type { LegalPageType } from "@/content/legal";
import { siteConfig } from "@/content/site-config";

// Shared renderer for the privacy and terms pages so the two stay visually identical.
export const LegalDocument = ({ page }: { page: LegalPageType }) => {
	return (
		<>
			{/* Left-aligned: these intros run to several sentences, which centred text makes much
			    harder to read. */}
			<PageHero align="start" eyebrow="Legal" intro={page.intro} title={page.title}>
				<p className="text-muted-foreground mt-5 text-sm">Last updated: {page.updated}</p>
			</PageHero>

			<section className="mx-auto w-full max-w-3xl px-page pb-section lg:px-page-lg lg:pb-section-lg">
				<div className="space-y-8">
					{page.sections.map((section) => (
						<div key={section.heading}>
							<h2 className="text-lg font-semibold tracking-tight">{section.heading}</h2>
							{section.body && <p className="text-muted-foreground mt-2">{section.body}</p>}
							{section.items && (
								<ul className="mt-2 space-y-2">
									{section.items.map((item) => (
										<li className="text-muted-foreground flex gap-2" key={item}>
											<span
												aria-hidden
												className="bg-primary mt-2 size-1.5 shrink-0 rounded-full"
											/>
											<span>{item}</span>
										</li>
									))}
								</ul>
							)}
						</div>
					))}
				</div>

				<p className="text-muted-foreground mt-12 border-t border-border pt-6 text-sm">
					Questions about this page? Email{" "}
					<a
						className="text-primary font-medium underline underline-offset-4"
						href={`mailto:${siteConfig.email}`}
					>
						{siteConfig.email}
					</a>{" "}
					or use the{" "}
					<Link className="text-primary font-medium underline underline-offset-4" href="/contact">
						contact page
					</Link>
					.
				</p>
			</section>
		</>
	);
};
