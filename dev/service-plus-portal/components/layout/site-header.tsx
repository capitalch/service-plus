"use client";

import { LogIn, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Logo } from "@/components/layout/logo";
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

export const SiteHeader = () => {
	const pathname = usePathname();
	const [mobileOpen, setMobileOpen] = useState(false);

	return (
		<header className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-xl">
			<div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 lg:px-6">
				<Logo />

				<nav className="ml-auto hidden items-center gap-1 md:flex">
					{navItems.map((item) => (
						<Link
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
					<Button asChild className="hidden sm:inline-flex">
						<a href={siteConfig.appUrl} rel="noopener">
							<LogIn />
							Login
						</a>
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
						<SheetContent className="w-[17rem] p-0" side="right">
							<SheetHeader className="border-b border-border/60 p-4 text-left">
								<SheetTitle>
									<Logo />
								</SheetTitle>
							</SheetHeader>
							<nav className="flex flex-col gap-1 p-3">
								{navItems.map((item) => (
									<Link
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
								<Button asChild className="mt-2">
									<a href={siteConfig.appUrl} rel="noopener">
										<LogIn />
										Login
									</a>
								</Button>
							</nav>
						</SheetContent>
					</Sheet>
				</div>
			</div>
		</header>
	);
};
