"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import { tr, type Locale } from "@/lib/i18n";

import {
  requestUniversityAction,
  type RequestUniversityState,
} from "./actions";

export type UniversityCard = {
  id: number;
  name: string;
  region: string | null;
  logoUrl: string | null;
  tier: "partner" | "open";
  offeringCount: number;
};

/** 대학 이름 이니셜 2자 — 로고가 없을 때. 이모지는 쓰지 않는다. */
function initials(name: string): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "—";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function UniversitiesClient({
  locale,
  universities,
}: {
  locale: Locale;
  universities: UniversityCard[];
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return universities;
    return universities.filter(
      (u) =>
        u.name.toLowerCase().includes(term) ||
        (u.region ?? "").toLowerCase().includes(term)
    );
  }, [q, universities]);

  const partners = filtered.filter((u) => u.tier === "partner");
  const opens = filtered.filter((u) => u.tier === "open");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="gc-page-title">
          {tr(locale, "대학 찾기", "Tìm trường")}
        </h1>
        <p className="gc-page-desc">
          {tr(
            locale,
            "지원할 대학을 선택하고 서류 작성을 시작하세요.",
            "Chọn trường muốn đăng ký và bắt đầu soạn hồ sơ."
          )}
        </p>
      </div>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={tr(
          locale,
          "대학 이름 · 지역 검색",
          "Tìm theo tên trường · khu vực"
        )}
        className="gc-input"
      />

      <Section
        locale={locale}
        title={tr(locale, "협약 대학", "Trường liên kết")}
        hint={tr(
          locale,
          "서류 작성(무료) + 발급 서류 대행(유료) + 지원 컨설팅(무료)",
          "Soạn hồ sơ (miễn phí) + Dịch vụ xin cấp giấy tờ (trả phí) + Tư vấn đăng ký (miễn phí)"
        )}
        accent="emerald"
        list={partners}
      />

      <Section
        locale={locale}
        title={tr(locale, "자유 지원 대학", "Trường tự do đăng ký")}
        hint={tr(
          locale,
          "서류 작성(무료) + 발급 서류 대행(유료)",
          "Soạn hồ sơ (miễn phí) + Dịch vụ xin cấp giấy tờ (trả phí)"
        )}
        accent="sky"
        list={opens}
      />

      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-ink-xlight">
          {tr(
            locale,
            "검색 결과가 없습니다.",
            "Không có kết quả tìm kiếm."
          )}
        </p>
      )}

      <RequestBox locale={locale} />
    </div>
  );
}

function Section({
  locale,
  title,
  hint,
  accent,
  list,
}: {
  locale: Locale;
  title: string;
  hint: string;
  accent: "emerald" | "sky";
  list: UniversityCard[];
}) {
  if (list.length === 0) return null;
  /* 구분은 색이 아니라 배지 하나로 — 섹션마다 새 색을 만들지 않는다. */
  return (
    <section>
      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="gc-page-title">{title}</h2>
          <span
            className={`gc-badge ${
              accent === "emerald" ? "gc-badge-tonal" : "gc-badge-neutral"
            }`}
          >
            {list.length}
          </span>
        </div>
        <p className="gc-page-desc">{hint}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((u) => (
          <Card key={u.id} locale={locale} u={u} />
        ))}
      </div>
    </section>
  );
}

function Card({ locale, u }: { locale: Locale; u: UniversityCard }) {
  return (
    <Link
      href={`/student/universities/${u.id}`}
      className="gc-card gc-card-hover flex flex-col"
    >
      <div className="flex items-center gap-3">
        {u.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={u.logoUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-input border border-line-soft object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-input bg-subtle">
            {initials(u.name)}
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink">
            {u.name}
          </div>
          {u.region && (
            <div className="truncate text-xs text-ink-light">{u.region}</div>
          )}
        </div>
      </div>
      <div className="mt-3">
        {u.offeringCount > 0 ? (
          <span className="gc-badge gc-badge-neutral">
            {tr(
              locale,
              `${u.offeringCount}개 과정 모집 중`,
              `Đang tuyển ${u.offeringCount} chương trình`
            )}
          </span>
        ) : (
          <span className="gc-badge gc-badge-neutral">
            {tr(locale, "모집 예정", "Sắp tuyển")}
          </span>
        )}
      </div>
    </Link>
  );
}

function RequestBox({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<
    RequestUniversityState,
    FormData
  >(requestUniversityAction, undefined);

  const done = state && "ok" in state && state.ok;

  return (
    <section className="gc-card-dashed">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ink-mid">
            {tr(locale, "찾는 대학이 없나요?", "Không thấy trường bạn cần?")}
          </h2>
          <p className="mt-0.5 text-xs text-ink-light">
            {tr(
              locale,
              "요청하시면 글로케어가 검토 후 추가해 드립니다.",
              "Gửi yêu cầu, Glocare sẽ xem xét và bổ sung."
            )}
          </p>
        </div>
        {!open && !done && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 gc-btn gc-btn-secondary gc-btn-md"
          >
            {tr(locale, "대학 요청", "Yêu cầu trường")}
          </button>
        )}
      </div>

      {done && (
        <p className="mt-3 gc-note bg-success-bg text-success-ink">
          {tr(
            locale,
            "요청이 접수되었습니다. 검토 후 목록에 추가되면 알려드립니다.",
            "Đã nhận yêu cầu. Chúng tôi sẽ báo khi trường được thêm vào."
          )}
        </p>
      )}

      {open && !done && (
        <form action={formAction} className="mt-3 space-y-2">
          <div>
            <input
              name="university_name"
              required
              placeholder={tr(
                locale,
                "대학 이름 (필수)",
                "Tên trường (bắt buộc)"
              )}
              className="gc-input"
            />
            {state && "fieldErrors" in state && state.fieldErrors?.university_name && (
              <p className="mt-1 text-xs text-destructive">
                {tr(locale, "대학 이름을 입력하세요", "Vui lòng nhập tên trường")}
              </p>
            )}
          </div>
          <input
            name="university_url"
            placeholder={tr(
              locale,
              "홈페이지 주소 (선택)",
              "Website (không bắt buộc)"
            )}
            className="gc-input"
          />
          <textarea
            name="note"
            rows={2}
            placeholder={tr(
              locale,
              "희망 학과·전달 사항 (선택)",
              "Ngành mong muốn · ghi chú (không bắt buộc)"
            )}
            className="gc-input"
          />
          {state && "error" in state && state.error && (
            <p className="text-xs text-destructive">{state.error}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="gc-btn gc-btn-primary gc-btn-md"
            >
              {pending
                ? tr(locale, "보내는 중…", "Đang gửi…")
                : tr(locale, "요청 보내기", "Gửi yêu cầu")}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="gc-btn gc-btn-ghost text-ink-light"
            >
              {tr(locale, "취소", "Hủy")}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
