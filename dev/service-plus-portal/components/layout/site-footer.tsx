import { Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/layout/logo";
import { navItems, siteConfig } from "@/content/site-config";

export const SiteFooter = () => {
	const { address } = siteConfig;

	return (
		<footer className="border-t border-border/60 bg-muted/40">
			<div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-3 lg:px-6">
				<div className="space-y-3">
					<Logo />
					<p className="max-w-xs text-sm text-muted-foreground">{siteConfig.description}</p>
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
							<a className="text-muted-foreground hover:text-foreground" href={siteConfig.appUrl}>
								Login
							</a>
						</li>
					</ul>
				</div>

				<div className="space-y-3">
					<h2 className="text-sm font-semibold">Contact</h2>
					<ul className="space-y-2 text-sm text-muted-foreground">
						<li className="flex items-center gap-2">
							<Phone className="size-4 shrink-0" />
							<a className="hover:text-foreground" href={`tel:${siteConfig.phoneE164}`}>
								{siteConfig.phone}
							</a>
						</li>
						<li className="flex items-center gap-2">
							<Mail className="size-4 shrink-0" />
							<a className="hover:text-foreground" href={`mailto:${siteConfig.email}`}>
								{siteConfig.email}
							</a>
						</li>
						<li className="flex items-start gap-2">
							<MapPin className="mt-0.5 size-4 shrink-0" />
							<span>
								{address.city}, {address.state}
							</span>
						</li>
					</ul>
				</div>
			</div>
			<p className="border-t border-border/60 px-4 py-4 text-center text-xs text-muted-foreground">
				© {new Date().getFullYear()} {siteConfig.company}. Service+ is a product of {siteConfig.company}.
			</p>
		</footer>
	);
};
