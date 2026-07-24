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
  emoji: string | null;
  logoUrl: string | null;
  tier: "partner" | "open";
  offeringCount: number;
};

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
        <h1 className="text-xl font-bold text-slate-900">
          {tr(locale, "대학 찾기", "Tìm trường")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
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
        className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-slate-400"
      />

      <Section
        locale={locale}
        title={tr(locale, "협약 대학", "Trường liên kết")}
        hint={tr(
          locale,
          "서류 작성 + 지원 컨설팅을 함께 지원",
          "Hỗ trợ soạn hồ sơ + tư vấn đăng ký"
        )}
        accent="emerald"
        list={partners}
      />

      <Section
        locale={locale}
        title={tr(locale, "자유 지원 대학", "Trường tự do đăng ký")}
        hint={tr(
          locale,
          "서류 작성을 지원 (직접 지원)",
          "Hỗ trợ soạn hồ sơ (bạn tự đăng ký)"
        )}
        accent="sky"
        list={opens}
      />

      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-400">
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
  const dot =
    accent === "emerald" ? "bg-emerald-500" : "bg-sky-500";
  return (
    <section>
      <div className="mb-2 flex items-baseline gap-2">
        <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        <span className="text-xs text-slate-400">{hint}</span>
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
      className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
    >
      <div className="flex items-center gap-3">
        {u.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={u.logoUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-lg border border-slate-100 object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-lg">
            {u.emoji ?? "🎓"}
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">
            {u.name}
          </div>
          {u.region && (
            <div className="truncate text-xs text-slate-500">{u.region}</div>
          )}
        </div>
      </div>
      <div className="mt-3">
        {u.offeringCount > 0 ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
            {tr(
              locale,
              `${u.offeringCount}개 과정 모집 중`,
              `Đang tuyển ${u.offeringCount} chương trình`
            )}
          </span>
        ) : (
          <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-400">
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
    <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">
            {tr(locale, "찾는 대학이 없나요?", "Không thấy trường bạn cần?")}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
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
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {tr(locale, "대학 요청", "Yêu cầu trường")}
          </button>
        )}
      </div>

      {done && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
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
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
            {state && "fieldErrors" in state && state.fieldErrors?.university_name && (
              <p className="mt-1 text-xs text-rose-600">
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
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400"
          />
          <textarea
            name="note"
            rows={2}
            placeholder={tr(
              locale,
              "희망 학과·전달 사항 (선택)",
              "Ngành mong muốn · ghi chú (không bắt buộc)"
            )}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400"
          />
          {state && "error" in state && state.error && (
            <p className="text-xs text-rose-600">{state.error}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {pending
                ? tr(locale, "보내는 중…", "Đang gửi…")
                : tr(locale, "요청 보내기", "Gửi yêu cầu")}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
            >
              {tr(locale, "취소", "Hủy")}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
