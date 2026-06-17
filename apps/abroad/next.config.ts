import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Node 24 + 이 Next dev 의 jest-worker child_process 가 스폰 직후 죽어
    // 동적 [id] 라우트(학생 상세 등)가 WorkerError 로 500. worker_threads 로 회피.
    workerThreads: true,
    // Route Handler body 한계 (어드민 측이 multipart 로 PDF 전달)
    proxyClientMaxBodySize: "60mb",
    serverActions: {
      // PDF 40MB + 엑셀 5MB 모두 수용
      bodySizeLimit: "45mb",
    },
  },
};

export default nextConfig;
