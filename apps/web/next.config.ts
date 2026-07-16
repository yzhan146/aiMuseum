import path from "node:path";
import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@ai-museum/sdk", "@ai-museum/characters"],
};
export default nextConfig;
