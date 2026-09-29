import { ArrowUpRight, Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Reveal } from "@/components/layout/reveal";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/content/site-config";

type ContactCardType = {
	action?: { href: string; label: string; external: boolean };
	icon: LucideIcon;
	lines: string[];
	title: string;
};

function contactCards(): ContactCardType[] {
	const { address } = siteConfig;
	return [
		{
			action: { external: false, href: `tel:${siteConfig.phoneE164}`, label: "Call now" },
			icon: Phone,
			lines: [siteConfig.phone],
			title: "Mobile",
		},
		{
			action: { external: true, href: `https://wa.me/${siteConfig.whatsapp}`, label: "Open WhatsApp" },
			icon: MessageCircle,
			lines: [siteConfig.phone],
			title: "WhatsApp",
		},
		{
			action: { external: false, href: `mailto:${siteConfig.email}`, label: "Send email" },
			icon: Mail,
			lines: [siteConfig.email],
			title: "Email",
		},
		{
			action: { external: true, href: address.mapUrl, label: "Open in Maps" },
			icon: MapPin,
			lines: [
				address.line1,
				address.line2,
				`${address.city} ${address.pincode}`,
				`${address.state}, ${address.country}`,
			],
			title: "Address",
		},
		{
			icon: Clock,
			lines: [siteConfig.businessHours, "Closed Sundays and public holidays"],
			title: "Business hours",
		},
	];
}

export const ContactCards = () => {
	return (
		<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
			{contactCards().map((card, index) => (
				<Reveal delay={index * 0.05} key={card.title}>
					<article className="card-lift group bg-card flex h-full flex-col rounded-2xl border border-border p-6 shadow-xs">
						<span className="bg-primary/10 text-primary group-hover:bg-gradient-brand group-hover:text-white flex size-11 items-center justify-center rounded-xl transition-colors duration-300">
							<card.icon aria-hidden className="size-5" />
						</span>
						<h2 className="mt-4 font-semibold">{card.title}</h2>
						<address className="text-muted-foreground mt-2 flex-1 text-sm break-words not-italic">
							{card.lines.map((line) => (
								<span className="block" key={line}>
									{line}
								</span>
							))}
						</address>
						{card.action && (
							<Button asChild className="mt-4 w-full justify-between" size="sm" variant="outline">
								<a
									href={card.action.href}
									rel={card.action.external ? "noopener noreferrer" : undefined}
									target={card.action.external ? "_blank" : undefined}
								>
									{card.action.label}
									<ArrowUpRight aria-hidden className="size-4" />
								</a>
							</Button>
						)}
					</article>
				</Reveal>
			))}
		</div>
	);
};
