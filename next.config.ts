import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Route Handler body 한계 (모집요강 PDF + base64 1.33배 오버헤드 대응)
    // Server Action 의 bodySizeLimit 와 별개. 기본 10MB.
    proxyClientMaxBodySize: "60mb",
    serverActions: {
      // 모집요강 PDF — 리플릿(디자인 파일) 큰 케이스 대응 (40MB)
      bodySizeLimit: "40mb",
    },
  },
};

export default nextConfig;
