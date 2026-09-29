"use client";

import { LogIn, Menu, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Logo } from "@/components/layout/logo";
import { ScrollProgress } from "@/components/layout/scroll-progress";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { navItems, siteConfig } from "@/content/site-config";
import { cn } from "@/lib/utils";

// trailingSlash makes the live pathname "/pricing/", while nav hrefs are "/pricing".
function isActive(pathname: string, href: string): boolean {
	const normalized = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
	return normalized === href;
}

// Drives the border/shadow switch once the page has moved, so the header only looks "lifted"
// when something is actually behind it. A scroll listener beats useScroll here because we need
// a boolean, not a continuous value, and this keeps the header free of re-renders per frame.
function useScrolled(threshold = 8): boolean {
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > threshold);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, [threshold]);

	return scrolled;
}

export const SiteHeader = () => {
	const pathname = usePathname();
	const [mobileOpen, setMobileOpen] = useState(false);
	const scrolled = useScrolled();

	return (
		<header
			className={cn(
				"sticky top-0 z-40 border-b backdrop-blur-xl transition-shadow duration-300",
				scrolled ? "border-border bg-background/85 shadow-sm" : "border-transparent bg-background/60",
			)}
		>
			{/* border-b already draws a line; the progress bar overlays it rather than adding height. */}
			<div className="pointer-events-none absolute inset-0">
				<ScrollProgress />
			</div>
			<div className="relative mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-page lg:px-page-lg">
				<Logo />

				<nav aria-label="Main" className="ml-auto hidden items-center gap-1 md:flex">
					{navItems.map((item) => (
						<Link
							aria-current={isActive(pathname, item.href) ? "page" : undefined}
							className={cn(
								"rounded-lg px-3 py-2 text-sm font-medium transition-colors",
								isActive(pathname, item.href)
									? "bg-primary/10 text-primary"
									: "text-muted-foreground hover:bg-muted hover:text-foreground",
							)}
							href={item.href}
							key={item.href}
						>
							{item.label}
						</Link>
					))}
				</nav>

				<div className="ml-auto flex items-center gap-2 md:ml-2">
					<ThemeToggle />
					<Button asChild className="hidden sm:inline-flex" size="sm" variant="ghost">
						<a href={siteConfig.appUrl} rel="noopener">
							<LogIn />
							Login
						</a>
					</Button>
					{/* typedRoutes rejects a hash inside a string href, so the path and hash go separately. */}
					<Button asChild className="hidden sm:inline-flex" size="sm">
						<Link href={{ hash: "#enquire", pathname: "/pricing/" }}>Get started</Link>
					</Button>

					<Sheet onOpenChange={setMobileOpen} open={mobileOpen}>
						<SheetTrigger asChild>
							<Button
								aria-label="Open menu"
								className="md:hidden"
								size="icon"
								type="button"
								variant="outline"
							>
								<Menu className="size-4" />
							</Button>
						</SheetTrigger>
						<SheetContent className="flex w-[17rem] flex-col p-0" side="right">
							<SheetHeader className="border-b border-border/60 p-4 text-left">
								<SheetTitle>
									<Logo />
								</SheetTitle>
							</SheetHeader>
							<nav aria-label="Mobile" className="flex flex-col gap-1 p-3">
								{navItems.map((item) => (
									<Link
										aria-current={isActive(pathname, item.href) ? "page" : undefined}
										className={cn(
											"rounded-xl px-3 py-3 text-sm font-medium transition-colors",
											isActive(pathname, item.href)
												? "bg-primary/10 text-primary"
												: "text-muted-foreground hover:bg-muted hover:text-foreground",
										)}
										href={item.href}
										key={item.href}
										onClick={() => setMobileOpen(false)}
									>
										{item.label}
									</Link>
								))}
							</nav>
							<div className="mt-auto space-y-2 border-t border-border/60 p-3">
								<Button asChild className="w-full">
									<Link
										href={{ hash: "#enquire", pathname: "/pricing/" }}
										onClick={() => setMobileOpen(false)}
									>
										Get started
									</Link>
								</Button>
								<Button asChild className="w-full" variant="outline">
									<a href={siteConfig.appUrl} rel="noopener">
										<LogIn />
										Login to the app
									</a>
								</Button>
								<div className="grid grid-cols-2 gap-2 pt-1">
									<Button asChild size="sm" variant="ghost">
										<a href={`tel:${siteConfig.phoneE164}`}>
											<Phone />
											Call
										</a>
									</Button>
									<Button asChild size="sm" variant="ghost">
										<a href={`https://wa.me/${siteConfig.whatsapp}`} rel="noopener" target="_blank">
											<MessageCircle />
											WhatsApp
										</a>
									</Button>
								</div>
								<div className="flex justify-center pt-1">
									<ThemeToggle variant="ghost" />
								</div>
							</div>
						</SheetContent>
					</Sheet>
				</div>
			</div>
		</header>
	);
};
