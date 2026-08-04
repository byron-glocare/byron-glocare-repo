"use client";

/**
 * EditProvider 래퍼 — 오버라이드를 런타임에 /api/overrides(GET, DB) 에서 불러와 주입.
 *   - 초기값은 커밋된 overrides.json/.vi.json(즉시 렌더), 마운트 후 DB 값으로 교체.
 *   - 배포된 사이트에서 편집→저장(DB)하면, 이후 로드에 즉시 반영.
 */
import React, { useEffect, useState } from "react";
import { EditProvider } from "@glocare/visa-core";
import baseKo from "@/data/overrides.json";
import baseVi from "@/data/overrides.vi.json";

type Ov = { ko: Record<string, string>; vi: Record<string, string> };
const BASE: Ov = { ko: baseKo as Record<string, string>, vi: baseVi as Record<string, string> };

export function LiveEditProvider({ children, defaultOn = false }: { children: React.ReactNode; defaultOn?: boolean }) {
  const [ov, setOv] = useState<Ov>(BASE);
  useEffect(() => {
    let alive = true;
    fetch("/api/overrides")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d && typeof d === "object") setOv({ ko: d.ko ?? {}, vi: d.vi ?? {} });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return (
    <EditProvider overrides={ov} persistKey="visa" defaultOn={defaultOn}>
      {children}
    </EditProvider>
  );
}
