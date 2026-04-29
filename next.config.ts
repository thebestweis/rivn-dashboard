import type { NextConfig } from "next";

const productionAssetHost =
  process.env.NEXT_PUBLIC_ASSET_HOST?.replace(/\/$/, "") ??
  "https://rivn-dashboard.vercel.app";

const nextConfig: NextConfig = {
  assetPrefix:
    process.env.NODE_ENV === "production" ? productionAssetHost : undefined,
};

export default nextConfig;
