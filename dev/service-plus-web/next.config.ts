import type { NextConfig } from "next";

// Static export for milesweb (shared cPanel/Apache hosting) — see deploy/README.md.
// If deployed under a subfolder rather than a subdomain root, set basePath/assetPrefix here.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  // TypeScript 7's compiler API differs from what Next's built-in typecheck step
  // expects by default (this repo pins TS 7 to match service-plus-client).
  experimental: { useTypeScriptCli: true },
};

export default nextConfig;
