import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
    ],
  },
  outputFileTracingIncludes: {
    "/": ["./data/**/*"],
    "/movie/[id]": ["./data/**/*"],
    "/api/movies": ["./data/**/*"],
    "/api/random": ["./data/**/*"],
  },
};

export default nextConfig;
