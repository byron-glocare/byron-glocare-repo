import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Node 24 + 이 Next dev 의 jest-worker child_process 회피 (abroad 앱과 동일)
    workerThreads: true,
  },
};

export default nextConfig;
