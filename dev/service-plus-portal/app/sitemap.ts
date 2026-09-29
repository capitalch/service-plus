import type { MetadataRoute } from "next";

import { siteConfig } from "@/content/site-config";

export const dynamic = "force-static";

const sitemap = (): MetadataRoute.Sitemap => {
	return ["/", "/features/", "/pricing/", "/contact/", "/privacy/", "/terms/"].map((path) => ({
		changeFrequency: "monthly",
		priority: path === "/" ? 1 : path === "/privacy/" || path === "/terms/" ? 0.3 : 0.8,
		url: `${siteConfig.url}${path}`,
	}));
};

export default sitemap;
