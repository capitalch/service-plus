import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Reveal } from "@/components/layout/reveal";
import { siteConfig } from "@/content/site-config";

type ContactCardType = {
	action?: { href: string; label: string };
	icon: LucideIcon;
	lines: string[];
	title: string;
};

function contactCards(): ContactCardType[] {
	const { address } = siteConfig;
	return [
		{
			action: { href: `tel:${siteConfig.phoneE164}`, label: "Call now" },
			icon: Phone,
			lines: [siteConfig.phone],
			title: "Mobile",
		},
		{
			action: { href: `https://wa.me/${siteConfig.whatsapp}`, label: "Open WhatsApp" },
			icon: MessageCircle,
			lines: [siteConfig.phone],
			title: "WhatsApp",
		},
		{
			action: { href: `mailto:${siteConfig.email}`, label: "Send email" },
			icon: Mail,
			lines: [siteConfig.email],
			title: "Email",
		},
		{
			action: { href: address.mapUrl, label: "Open map" },
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
			lines: [siteConfig.businessHours],
			title: "Business hours",
		},
	];
}

export const ContactCards = () => {
	return (
		<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
			{contactCards().map((card, index) => (
				<Reveal delay={index * 0.05} key={card.title}>
					<article className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-xs">
						<span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<card.icon className="size-5" />
						</span>
						<h2 className="mt-4 font-semibold">{card.title}</h2>
						<address className="mt-2 flex-1 text-sm text-muted-foreground not-italic">
							{card.lines.map((line) => (
								<span className="block break-words" key={line}>
									{line}
								</span>
							))}
						</address>
						{card.action && (
							<a
								className="mt-4 text-sm font-medium text-primary hover:underline"
								href={card.action.href}
								rel="noopener"
								target={card.action.href.startsWith("http") ? "_blank" : undefined}
							>
								{card.action.label} →
							</a>
						)}
					</article>
				</Reveal>
			))}
		</div>
	);
};
