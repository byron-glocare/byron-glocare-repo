import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Node 24 + 이 Next dev 의 jest-worker child_process 가 스폰 직후 죽어
    // 동적 [id] 라우트의 static-paths 생성/서버액션 재렌더가 WorkerError 로 500.
    // worker_threads 모드로 전환해 child_process fork 자체를 회피.
    workerThreads: true,
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
