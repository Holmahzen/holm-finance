import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse bundles pdfjs-dist, which loads its worker via a relative chunk
  // path that Turbopack/webpack can't resolve once bundled. Keeping it
  // external makes Next require() it straight from node_modules at runtime.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
