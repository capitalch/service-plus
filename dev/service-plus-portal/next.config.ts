import type { NextConfig } from "next";

// Static export for MilesWeb shared cPanel hosting — see deploy/README.md.
const nextConfig: NextConfig = {
	experimental: { useTypeScriptCli: true },
	images: { unoptimized: true },
	output: "export",
	// LiteSpeed on MilesWeb has MultiViews off: it serves pricing/index.html but never maps
	// /pricing to pricing.html. Without this every route but "/" 404s on direct load.
	trailingSlash: true,
	// A renamed route folder becomes a build error at each stale link instead of a runtime 404.
	typedRoutes: true,
};

export default nextConfig;
