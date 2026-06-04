import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Route Handler body 한계 (어드민 측이 multipart 로 PDF 전달)
    proxyClientMaxBodySize: "60mb",
    serverActions: {
      // PDF 40MB + 엑셀 5MB 모두 수용
      bodySizeLimit: "45mb",
    },
  },
};

export default nextConfig;
