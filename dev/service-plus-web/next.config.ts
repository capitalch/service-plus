import type { NextConfig } from "next";

// Static export for milesweb (shared cPanel/Apache hosting) — see deploy/README.md.
// If deployed under a subfolder rather than a subdomain root, set basePath/assetPrefix here.
const nextConfig: NextConfig = {
  output: "export",
  // Required on milesweb: LiteSpeed there has MultiViews off, so it never maps
  // /spare-parts to spare-parts.html — it only serves exact filenames and a
  // directory's index.html. trailingSlash emits spare-parts/index.html instead,
  // which the server's own trailing-slash redirect then resolves. Without this,
  // every route 404s on direct load/refresh (in-app navigation still works,
  // because the client router never asks the server for that path).
  trailingSlash: true,
  images: { unoptimized: true },
  // TypeScript 7's compiler API differs from what Next's built-in typecheck step
  // expects by default (this repo pins TS 7 to match service-plus-client).
  experimental: { useTypeScriptCli: true },
};

export default nextConfig;
