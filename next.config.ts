import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@aidenappleby/keyring-js"],
};

export default nextConfig;
