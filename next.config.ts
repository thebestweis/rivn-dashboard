import type { NextConfig } from "next";

const productionAssetHost = process.env.NEXT_PUBLIC_ASSET_HOST?.replace(
  /\/$/,
  ""
);

const nextConfig: NextConfig = {
  assetPrefix: productionAssetHost,
};

export default nextConfig;
