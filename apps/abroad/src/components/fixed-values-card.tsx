import { FIXED_STUDENT_VALUES } from "@/lib/fixed-values";
import { tr, type Locale } from "@/lib/i18n";

/**
 * 고정 입력값 안내 — 입력칸이 아니라 "이 값으로 들어갑니다" 표시.
 * 편집 대상이 아니므로 정보입력 목록에서 빼고 여기서 한 번만 보여준다.
 */
export function FixedValuesCard({
  locale,
  labels,
}: {
  locale: Locale;
  /** data_type_key → 표시 라벨 */
  labels: Record<string, string>;
}) {
  const rows = Object.entries(FIXED_STUDENT_VALUES).filter(
    ([key]) => labels[key]
  );
  if (rows.length === 0) return null;

  return (
    <div className="gc-card">
      <div className="gc-eyebrow-sm">
        {tr(locale, "자동 입력 항목", "Mục điền tự động")}
      </div>
      <p className="gc-page-desc">
        {tr(
          locale,
          "아래 항목은 입력하실 필요 없습니다. 서류에 항상 같은 값으로 들어갑니다.",
          "Các mục dưới đây bạn không cần nhập. Hệ thống luôn điền cùng một giá trị."
        )}
      </p>
      <dl className="legal-dl" style={{ marginTop: 12 }}>
        {rows.map(([key, value]) => (
          <div key={key}>
            <dt>{labels[key]}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
