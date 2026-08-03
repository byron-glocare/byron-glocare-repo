/**
 * 비자 서류 편집분(overrides)을 공유 DB(study_visa_overrides)에서 로드.
 *   유학센터 /center/visa 가 이 값을 EditProvider 에 주입해 비자앱 편집을 그대로 반영.
 *   base(rules 등)는 코드(@/lib/visa/*)에 있고, 여기선 편집분만 얹는다.
 */

import "server-only";

import { createClient } from "@/lib/supabase/server";

export type VisaOverrides = {
  ko: Record<string, string>;
  vi: Record<string, string>;
};

export async function loadVisaOverrides(): Promise<VisaOverrides> {
  const out: VisaOverrides = { ko: {}, vi: {} };
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("study_visa_overrides")
      .select("lang, data");
    for (const r of data ?? []) {
      if (r.lang === "ko" || r.lang === "vi") {
        out[r.lang] = (r.data ?? {}) as Record<string, string>;
      }
    }
  } catch {
    // DB 미구성/일시 오류 시 base 만으로 렌더(빈 오버라이드)
  }
  return out;
}
