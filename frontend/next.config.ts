import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 해커톤 속도 우선: Cache Components(PPR) 비활성. 데이터는 클라이언트에서 API/목 호출.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
};

export default nextConfig;
