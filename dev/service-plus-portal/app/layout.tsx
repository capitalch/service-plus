import type { Metadata } from "next";
import { Toaster } from "sonner";

import { MotionProvider } from "@/components/layout/motion-provider";
import { MobileActionBar } from "@/components/layout/mobile-action-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { siteConfig } from "@/content/site-config";

import "./globals.css";

export const metadata: Metadata = {
	description: siteConfig.description,
	keywords: [
		"electronics repair software",
		"repair shop management software",
		"service centre software India",
		"job card software",
		"spare parts inventory software",
		"GST invoicing for repair shops",
		"Service+",
	],
	metadataBase: new URL(siteConfig.url),
	openGraph: {
		description: siteConfig.description,
		locale: "en_IN",
		siteName: siteConfig.name,
		title: "Service+ — Repair workshop management software",
		type: "website",
		url: siteConfig.url,
	},
	title: {
		default: "Service+ — Repair workshop management software",
		template: "%s | Service+",
	},
};

// Applies the stored theme before first paint, so dark-mode visitors never see a light flash.
const themeInitScript = `
(function () {
	try {
		if (localStorage.getItem("sp-theme") === "dark") document.documentElement.classList.add("dark");
	} catch (e) {}
})();
`;

const RootLayout = ({ children }: { children: React.ReactNode }) => {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
			</head>
			<body className="flex min-h-screen flex-col antialiased">
				<ThemeProvider>
					<MotionProvider>
						{/* First tab stop: lets keyboard users jump the nav instead of tabbing through it. */}
						<a
							className="bg-background focus:ring-primary/40 sr-only rounded-lg border border-border px-4 py-2 text-sm font-medium shadow-lg focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:ring-3"
							href="#main"
						>
							Skip to content
						</a>
						<SiteHeader />
						<main className="min-w-0 flex-1" id="main" tabIndex={-1}>
							{children}
						</main>
						<SiteFooter />
						<MobileActionBar />
						<Toaster position="top-center" richColors />
					</MotionProvider>
				</ThemeProvider>
			</body>
		</html>
	);
};

export default RootLayout;
