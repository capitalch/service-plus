import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/layout/logo";
import { navItems, siteConfig } from "@/content/site-config";

export const SiteFooter = () => {
	const { address } = siteConfig;

	return (
		<footer className="border-border/60 bg-muted/40 border-t">
			{/* pb-28 clears the fixed mobile action bar, which would otherwise sit on these links. */}
			<div className="mx-auto grid w-full max-w-6xl gap-8 px-page py-10 sm:grid-cols-2 lg:grid-cols-4 lg:px-page-lg lg:pb-14">
				<div className="space-y-3">
					<Logo />
					<p className="text-muted-foreground max-w-xs text-sm">{siteConfig.description}</p>
				</div>

				<div className="space-y-3">
					<h2 className="text-sm font-semibold">Pages</h2>
					<ul className="space-y-2 text-sm">
						{navItems.map((item) => (
							<li key={item.href}>
								<Link className="text-muted-foreground hover:text-foreground" href={item.href}>
									{item.label}
								</Link>
							</li>
						))}
						<li>
							<a
								className="text-muted-foreground hover:text-foreground"
								href={siteConfig.appUrl}
								rel="noopener"
							>
								App login
							</a>
						</li>
					</ul>
				</div>

				<div className="space-y-3">
					<h2 className="text-sm font-semibold">Legal</h2>
					<ul className="space-y-2 text-sm">
						<li>
							<Link className="text-muted-foreground hover:text-foreground" href="/privacy">
								Privacy notice
							</Link>
						</li>
						<li>
							<Link className="text-muted-foreground hover:text-foreground" href="/terms">
								Terms of service
							</Link>
						</li>
					</ul>
				</div>

				<div className="space-y-3">
					<h2 className="text-sm font-semibold">Contact</h2>
					<ul className="text-muted-foreground space-y-2 text-sm">
						<li className="flex items-center gap-2">
							<Phone aria-hidden className="size-4 shrink-0" />
							<a className="hover:text-foreground" href={`tel:${siteConfig.phoneE164}`}>
								{siteConfig.phone}
							</a>
						</li>
						<li className="flex items-center gap-2">
							<MessageCircle aria-hidden className="size-4 shrink-0" />
							<a
								className="hover:text-foreground"
								href={`https://wa.me/${siteConfig.whatsapp}`}
								rel="noopener noreferrer"
								target="_blank"
							>
								WhatsApp
							</a>
						</li>
						<li className="flex items-center gap-2">
							<Mail aria-hidden className="size-4 shrink-0" />
							<a className="hover:text-foreground break-all" href={`mailto:${siteConfig.email}`}>
								{siteConfig.email}
							</a>
						</li>
						<li className="flex items-start gap-2">
							<MapPin aria-hidden className="mt-0.5 size-4 shrink-0" />
							<span>
								{address.city}, {address.state}
							</span>
						</li>
						<li className="pt-1 text-xs">{siteConfig.businessHours}</li>
					</ul>
				</div>
			</div>
			<p className="text-muted-foreground border-border/60 border-t px-page pt-4 pb-24 text-center text-xs lg:pb-4">
				© {new Date().getFullYear()} {siteConfig.company}. Service+ is a product of {siteConfig.company}.
			</p>
		</footer>
	);
};
