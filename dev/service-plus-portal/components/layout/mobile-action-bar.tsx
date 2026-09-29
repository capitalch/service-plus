"use client";

import { MessageCircle, Phone, Rocket } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { siteConfig } from "@/content/site-config";
import { cn } from "@/lib/utils";

// Most of the audience is on a phone, and "call us" is how a workshop owner actually converts.
// A fixed bar keeps that one tap away on every page. Hidden once the viewport is wide enough for
// the header's own CTAs, and lifted out of the way when the mobile menu is open.
export const MobileActionBar = () => {
	const [menuOpen, setMenuOpen] = useState(false);

	// The sheet is a modal dialog, so while it is open our bar would sit on top of it. Radix
	// portals the dialog into document.body on open and removes it on close, so watching body's
	// direct children is enough — no subtree observation needed.
	useEffect(() => {
		const hasDialog = () => document.querySelector("[role=dialog]") !== null;
		const observer = new MutationObserver(() => setMenuOpen(hasDialog()));
		observer.observe(document.body, { childList: true });
		return () => observer.disconnect();
	}, []);

	return (
		<div
			className={cn(
				"fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-lg transition-transform duration-300 lg:hidden",
				"pb-[env(safe-area-inset-bottom)]",
				menuOpen && "translate-y-full",
			)}
		>
			<div className="grid grid-cols-3 divide-x divide-border">
				<a
					className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/40 flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors focus-visible:ring-3 focus-visible:outline-none"
					href={`tel:${siteConfig.phoneE164}`}
				>
					<Phone aria-hidden className="size-5" />
					Call us
				</a>
				<a
					className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/40 flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors focus-visible:ring-3 focus-visible:outline-none"
					href={`https://wa.me/${siteConfig.whatsapp}`}
					rel="noopener"
					target="_blank"
				>
					<MessageCircle aria-hidden className="size-5" />
					WhatsApp
				</a>
				<Link
					className="text-primary flex flex-col items-center gap-1 py-2.5 text-xs font-semibold focus-visible:ring-ring/40 focus-visible:ring-3 focus-visible:outline-none"
					href={{ hash: "#enquire", pathname: "/pricing/" }}
				>
					<Rocket aria-hidden className="size-5" />
					Get started
				</Link>
			</div>
		</div>
	);
};
