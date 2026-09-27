import type { MetadataRoute } from "next";

import { siteConfig } from "@/content/site-config";

export const dynamic = "force-static";

const robots = (): MetadataRoute.Robots => {
	return {
		rules: { allow: "/", userAgent: "*" },
		sitemap: `${siteConfig.url}/sitemap.xml`,
	};
};

export default robots;
