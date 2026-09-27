import type { MetadataRoute } from "next";

import { siteConfig } from "@/content/site-config";

export const dynamic = "force-static";

const sitemap = (): MetadataRoute.Sitemap => {
	return ["/", "/pricing/", "/contact/"].map((path) => ({
		changeFrequency: "monthly",
		priority: path === "/" ? 1 : 0.8,
		url: `${siteConfig.url}${path}`,
	}));
};

export default sitemap;
