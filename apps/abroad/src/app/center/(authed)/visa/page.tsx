/**
 * /center/visa — 비자 서류 발급요건 조회 (읽기 전용).
 *   비자앱(apps/visa)의 표시 로직을 그대로 재사용(@/lib/visa/*),
 *   편집분(overrides)만 공유 DB(study_visa_overrides)에서 로드해 주입 → 비자앱 편집이 여기 반영.
 *   편집 UI 는 노출하지 않는다.
 */

import { verifyCenterSession } from "@/lib/center/dal";
import { loadVisaOverrides } from "@/lib/visa/load-overrides";

import { VisaContent } from "./visa-content";

export const dynamic = "force-dynamic";

export default async function CenterVisaPage() {
  await verifyCenterSession();
  const overrides = await loadVisaOverrides();
  return <VisaContent overrides={overrides} />;
}
