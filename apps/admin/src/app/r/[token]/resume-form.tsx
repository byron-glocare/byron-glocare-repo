"use client";

import { useState, useTransition } from "react";
import { submitResumeDraft, uploadResumePhoto } from "./actions";
import type { ResumeDraftDataInput } from "@/lib/validators";

type EduRow = { school: string; major: string; period: string; status: string };
type CarRow = {
  workplace: string;
  period: string;
  role: string;
  detail: string;
  status: string;
};
type CertRow = { name: string; issuer: string; date: string };
type SkillRow = { name: string; detail: string; level: string };
type ActRow = { name: string; period: string; org: string; detail: string };

const emptyEdu: EduRow = { school: "", major: "", period: "", status: "" };
const emptyCar: CarRow = {
  workplace: "",
  period: "",
  role: "",
  detail: "",
  status: "",
};
const emptyCert: CertRow = { name: "", issuer: "", date: "" };
const emptySkill: SkillRow = { name: "", detail: "", level: "" };
const emptyAct: ActRow = { name: "", period: "", org: "", detail: "" };

export function ResumeForm({
  token,
  initial,
  hasPhoto: hasPhotoInitial,
}: {
  token: string;
  initial: ResumeDraftDataInput;
  hasPhoto: boolean;
}) {
  const [name_vi, setNameVi] = useState(initial.name_vi ?? "");
  const [name_kr, setNameKr] = useState(initial.name_kr ?? "");
  const [birth_date, setBirthDate] = useState(initial.birth_date ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [email, setEmail] = useState(initial.email ?? "");
  const [address, setAddress] = useState(initial.address ?? "");
  const [one_liner, setOneLiner] = useState(initial.one_liner ?? "");
  const [educations, setEducations] = useState<EduRow[]>(
    initial.educations?.length
      ? (initial.educations as EduRow[])
      : [{ ...emptyEdu }]
  );
  const [careers, setCareers] = useState<CarRow[]>(
    initial.careers?.length ? (initial.careers as CarRow[]) : [{ ...emptyCar }]
  );
  const [certifications, setCertifications] = useState<CertRow[]>(
    initial.certifications?.length
      ? (initial.certifications as CertRow[])
      : [{ ...emptyCert }]
  );
  const [skills, setSkills] = useState<SkillRow[]>(
    initial.skills?.length ? (initial.skills as SkillRow[]) : [{ ...emptySkill }]
  );
  const [activities, setActivities] = useState<ActRow[]>(
    initial.activities?.length
      ? (initial.activities as ActRow[])
      : [{ ...emptyAct }]
  );
  const [narrative_raw, setNarrative] = useState(initial.narrative_raw ?? "");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [hasPhoto, setHasPhoto] = useState(hasPhotoInitial);
  const [photoBusy, setPhotoBusy] = useState(false);

  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<
    null | { ok: true } | { ok: false; error: string }
  >(null);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("사진 크기가 5MB를 초과합니다 / Ảnh quá 5MB");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setPhotoPreview(dataUrl);
      setPhotoBusy(true);
      const r = await uploadResumePhoto(token, dataUrl);
      setPhotoBusy(false);
      if (r.ok) {
        setHasPhoto(true);
      } else {
        alert(`사진 업로드 실패 / Upload thất bại: ${r.error}`);
        setPhotoPreview(null);
      }
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    if (!name_kr.trim() && !name_vi.trim()) {
      alert("이름을 입력해주세요 / Vui lòng nhập tên");
      return;
    }
    if (!narrative_raw.trim() || narrative_raw.trim().length < 50) {
      if (
        !confirm(
          "자기소개 본문이 너무 짧습니다. 그래도 제출할까요? / Phần tự giới thiệu hơi ngắn. Bạn vẫn muốn gửi không?"
        )
      )
        return;
    }
    startTransition(async () => {
      const payload: ResumeDraftDataInput = {
        name_vi,
        name_kr,
        birth_date,
        phone,
        email,
        address,
        one_liner,
        narrative_raw,
        narrative_polished: initial.narrative_polished ?? "",
        educations: educations.filter((r) => r.school || r.major || r.period),
        careers: careers.filter((r) => r.workplace || r.role || r.detail),
        certifications: certifications.filter((r) => r.name || r.issuer),
        skills: skills.filter((r) => r.name || r.detail),
        activities: activities.filter((r) => r.name || r.org || r.detail),
      };
      const r = await submitResumeDraft(token, payload);
      setResult(r);
      if (r.ok) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  if (result?.ok) {
    return (
      <div className="bg-card rounded-lg border border-success/30 bg-success/5 p-8 text-center space-y-2">
        <h2 className="text-xl font-semibold text-success">제출 완료</h2>
        <p className="text-sm text-muted-foreground">
          작성하신 내용이 잘 접수됐습니다. 감사합니다.
        </p>
        <p className="text-sm text-muted-foreground">
          Nội dung bạn điền đã được tiếp nhận. Cảm ơn bạn.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 가이드 */}
      <div className="bg-info/5 border border-info/30 rounded-lg p-4 text-sm space-y-2">
        <p className="font-medium">작성 안내 / Hướng dẫn điền</p>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>
            대부분 한국어로 작성해주세요. / Vui lòng điền chủ yếu bằng tiếng
            Hàn.
          </li>
          <li>
            마지막 "자기소개 및 포부" 만 베트남어로 편하게 써주셔도 됩니다. /
            Phần "Tự giới thiệu" cuối có thể viết bằng tiếng Việt.
          </li>
          <li>
            "+추가" 버튼으로 학력·경력·자격증을 여러 개 등록할 수 있습니다. /
            Có thể thêm nhiều mục bằng nút "+추가".
          </li>
          <li>
            7일 안에 작성해주세요. 중간 저장은 없습니다 — 한 번에 끝까지 작성
            후 제출 / Vui lòng hoàn thành trong 7 ngày. Không có lưu giữa
            chừng.
          </li>
        </ul>
      </div>

      <Section title="증명사진 / Ảnh thẻ">
        <p className="text-xs text-muted-foreground">
          JPEG / PNG / WebP, 최대 5MB. 이력서 좌측 상단에 들어갑니다.
          <br />
          JPEG / PNG / WebP, tối đa 5MB. Sẽ được đặt ở góc trên bên trái của
          CV.
        </p>
        <div className="flex items-start gap-3">
          {(photoPreview || hasPhoto) && (
            <div className="size-28 rounded-md border border-border bg-muted overflow-hidden flex items-center justify-center">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs text-muted-foreground">
                  업로드됨
                </span>
              )}
            </div>
          )}
          <label className="cursor-pointer">
            <span className="inline-flex items-center gap-1 h-9 rounded-md border border-input bg-background px-3 text-sm hover:bg-muted/30">
              {photoBusy
                ? "업로드 중... / Đang tải..."
                : hasPhoto || photoPreview
                  ? "사진 변경 / Đổi ảnh"
                  : "사진 선택 / Chọn ảnh"}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoChange}
              disabled={photoBusy}
              className="hidden"
            />
          </label>
        </div>
      </Section>

      <Section title="개인 정보 / Thông tin cá nhân">
        <Field
          label="베트남 이름 (영문 대문자)"
          labelVi="Tên tiếng Việt (chữ in hoa)"
          hint="예: NGUYEN THI VAN ANH"
        >
          <input
            value={name_vi}
            onChange={(e) => setNameVi(e.target.value.toUpperCase())}
            className={inputCls}
            placeholder="NGUYEN THI VAN ANH"
          />
        </Field>
        <Field
          label="한글 이름"
          labelVi="Tên tiếng Hàn"
          hint="예: 응우옌 티 반 안"
        >
          <input
            value={name_kr}
            onChange={(e) => setNameKr(e.target.value)}
            className={inputCls}
            placeholder="응우옌 티 반 안"
          />
        </Field>
        <Field
          label="생년월일"
          labelVi="Ngày sinh"
          hint="예: 2002년 11월 3일 / 2002-11-03"
        >
          <input
            value={birth_date}
            onChange={(e) => setBirthDate(e.target.value)}
            className={inputCls}
            placeholder="2002년 11월 3일"
          />
        </Field>
        <Field
          label="한국 전화번호"
          labelVi="Số điện thoại Hàn Quốc"
          hint="예: 010-1234-5678"
        >
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputCls}
            placeholder="010-1234-5678"
          />
        </Field>
        <Field label="이메일" labelVi="Email" hint="예: example@gmail.com">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
            placeholder="example@gmail.com"
            type="email"
          />
        </Field>
        <Field
          label="한국 내 주소"
          labelVi="Địa chỉ ở Hàn Quốc"
          hint="예: 서울시 광진구 능동로 120, 창의관 202호 / Nếu có thể chuyển nhà gần nơi làm: thêm '(근무처 근처로 이사가능합니다)'"
        >
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={inputCls}
            placeholder="서울시 광진구 능동로 120, 창의관 202호 (근무처 근처로 이사가능합니다)"
          />
        </Field>
        <Field
          label="한 줄 자기소개"
          labelVi="Một câu giới thiệu bản thân"
          hint="이력서 맨 위에 들어가는 한 줄. 예: 어르신을 따뜻한 마음으로 돌보는 요양보호사가 되고 싶습니다."
        >
          <input
            value={one_liner}
            onChange={(e) => setOneLiner(e.target.value)}
            className={inputCls}
            placeholder="어르신을 따뜻한 마음으로 돌보는 요양보호사가 되고 싶습니다."
          />
        </Field>
      </Section>

      <Section title="학력 / Học vấn">
        <ListGuide>
          한국대학교 / 경영학과 / 2023년 졸업 처럼 학교명·전공·기간·졸업여부
          순으로
        </ListGuide>
        {educations.map((row, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <input
              value={row.school}
              onChange={(e) =>
                setEducations((prev) =>
                  prev.map((r, j) =>
                    j === i ? { ...r, school: e.target.value } : r
                  )
                )
              }
              className={inputCls}
              placeholder="학교명 / Trường"
            />
            <input
              value={row.major}
              onChange={(e) =>
                setEducations((prev) =>
                  prev.map((r, j) =>
                    j === i ? { ...r, major: e.target.value } : r
                  )
                )
              }
              className={inputCls}
              placeholder="전공 / Chuyên ngành"
            />
            <input
              value={row.period}
              onChange={(e) =>
                setEducations((prev) =>
                  prev.map((r, j) =>
                    j === i ? { ...r, period: e.target.value } : r
                  )
                )
              }
              className={inputCls}
              placeholder="기간 / Thời gian"
            />
            <div className="flex gap-1">
              <input
                value={row.status}
                onChange={(e) =>
                  setEducations((prev) =>
                    prev.map((r, j) =>
                      j === i ? { ...r, status: e.target.value } : r
                    )
                  )
                }
                className={inputCls + " flex-1"}
                placeholder="졸업/재학 / Tốt nghiệp"
              />
              <RemoveBtn
                onClick={() =>
                  setEducations((prev) => prev.filter((_, j) => j !== i))
                }
              />
            </div>
          </div>
        ))}
        <AddBtn onClick={() => setEducations((p) => [...p, { ...emptyEdu }])} />
      </Section>

      <Section title="경력 (선택) / Kinh nghiệm (Tuỳ chọn)">
        <ListGuide>
          편의점·식당·공장 등 모든 알바 / 경력도 포함해서 적어주세요.
          <br />
          Lưu ý: ngay cả việc làm thêm quán ăn, công xưởng... cũng điền vào
          đây, tránh để trống.
        </ListGuide>
        {careers.map((row, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            <input
              value={row.workplace}
              onChange={(e) =>
                setCareers((p) =>
                  p.map((r, j) =>
                    j === i ? { ...r, workplace: e.target.value } : r
                  )
                )
              }
              className={inputCls}
              placeholder="근무처 / Nơi làm"
            />
            <input
              value={row.period}
              onChange={(e) =>
                setCareers((p) =>
                  p.map((r, j) =>
                    j === i ? { ...r, period: e.target.value } : r
                  )
                )
              }
              className={inputCls}
              placeholder="기간 / Thời gian"
            />
            <input
              value={row.role}
              onChange={(e) =>
                setCareers((p) =>
                  p.map((r, j) =>
                    j === i ? { ...r, role: e.target.value } : r
                  )
                )
              }
              className={inputCls}
              placeholder="직책 / Vị trí"
            />
            <input
              value={row.detail}
              onChange={(e) =>
                setCareers((p) =>
                  p.map((r, j) =>
                    j === i ? { ...r, detail: e.target.value } : r
                  )
                )
              }
              className={inputCls}
              placeholder="업무 상세 / Mô tả"
            />
            <div className="flex gap-1">
              <input
                value={row.status}
                onChange={(e) =>
                  setCareers((p) =>
                    p.map((r, j) =>
                      j === i ? { ...r, status: e.target.value } : r
                    )
                  )
                }
                className={inputCls + " flex-1"}
                placeholder="재직/퇴사"
              />
              <RemoveBtn
                onClick={() =>
                  setCareers((p) => p.filter((_, j) => j !== i))
                }
              />
            </div>
          </div>
        ))}
        <AddBtn onClick={() => setCareers((p) => [...p, { ...emptyCar }])} />
      </Section>

      <Section title="자격증 · 수상 (선택) / Chứng chỉ · Giải thưởng">
        <ListGuide>
          요양보호사 자격증 / 한국보건의료인국가시험원 / 25년 8월 처럼 명칭 /
          발급기관 / 취득일 순으로. 봉사활동·헌혈도 좋아요.
        </ListGuide>
        {certifications.map((row, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              value={row.name}
              onChange={(e) =>
                setCertifications((p) =>
                  p.map((r, j) =>
                    j === i ? { ...r, name: e.target.value } : r
                  )
                )
              }
              className={inputCls}
              placeholder="명칭 / Tên"
            />
            <input
              value={row.issuer}
              onChange={(e) =>
                setCertifications((p) =>
                  p.map((r, j) =>
                    j === i ? { ...r, issuer: e.target.value } : r
                  )
                )
              }
              className={inputCls}
              placeholder="발급기관 / Cơ quan cấp"
            />
            <div className="flex gap-1">
              <input
                value={row.date}
                onChange={(e) =>
                  setCertifications((p) =>
                    p.map((r, j) =>
                      j === i ? { ...r, date: e.target.value } : r
                    )
                  )
                }
                className={inputCls + " flex-1"}
                placeholder="취득일 / Ngày cấp"
              />
              <RemoveBtn
                onClick={() =>
                  setCertifications((p) => p.filter((_, j) => j !== i))
                }
              />
            </div>
          </div>
        ))}
        <AddBtn
          onClick={() =>
            setCertifications((p) => [...p, { ...emptyCert }])
          }
        />
      </Section>

      <Section title="기술 · 어학 / Kỹ năng · Ngoại ngữ">
        <ListGuide>
          한국어 / 일상대화 가능, 베트남어 / 모국어, MS Word·Excel / 중급 처럼
        </ListGuide>
        {skills.map((row, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              value={row.name}
              onChange={(e) =>
                setSkills((p) =>
                  p.map((r, j) =>
                    j === i ? { ...r, name: e.target.value } : r
                  )
                )
              }
              className={inputCls}
              placeholder="명칭 / Tên"
            />
            <input
              value={row.detail}
              onChange={(e) =>
                setSkills((p) =>
                  p.map((r, j) =>
                    j === i ? { ...r, detail: e.target.value } : r
                  )
                )
              }
              className={inputCls}
              placeholder="상세 / Chi tiết"
            />
            <div className="flex gap-1">
              <input
                value={row.level}
                onChange={(e) =>
                  setSkills((p) =>
                    p.map((r, j) =>
                      j === i ? { ...r, level: e.target.value } : r
                    )
                  )
                }
                className={inputCls + " flex-1"}
                placeholder="수준 / Mức độ"
              />
              <RemoveBtn
                onClick={() => setSkills((p) => p.filter((_, j) => j !== i))}
              />
            </div>
          </div>
        ))}
        <AddBtn onClick={() => setSkills((p) => [...p, { ...emptySkill }])} />
      </Section>

      <Section title="기타 활동 (선택) / Hoạt động khác">
        <ListGuide>
          요양원 봉사·학우회 등. 활동명 / 기간 / 기관 / 상세
        </ListGuide>
        {activities.map((row, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <input
              value={row.name}
              onChange={(e) =>
                setActivities((p) =>
                  p.map((r, j) =>
                    j === i ? { ...r, name: e.target.value } : r
                  )
                )
              }
              className={inputCls}
              placeholder="활동명 / Tên hoạt động"
            />
            <input
              value={row.period}
              onChange={(e) =>
                setActivities((p) =>
                  p.map((r, j) =>
                    j === i ? { ...r, period: e.target.value } : r
                  )
                )
              }
              className={inputCls}
              placeholder="기간 / Thời gian"
            />
            <input
              value={row.org}
              onChange={(e) =>
                setActivities((p) =>
                  p.map((r, j) =>
                    j === i ? { ...r, org: e.target.value } : r
                  )
                )
              }
              className={inputCls}
              placeholder="기관 / Tổ chức"
            />
            <div className="flex gap-1">
              <input
                value={row.detail}
                onChange={(e) =>
                  setActivities((p) =>
                    p.map((r, j) =>
                      j === i ? { ...r, detail: e.target.value } : r
                    )
                  )
                }
                className={inputCls + " flex-1"}
                placeholder="상세 / Mô tả"
              />
              <RemoveBtn
                onClick={() =>
                  setActivities((p) => p.filter((_, j) => j !== i))
                }
              />
            </div>
          </div>
        ))}
        <AddBtn
          onClick={() => setActivities((p) => [...p, { ...emptyAct }])}
        />
      </Section>

      <Section title="자기소개 및 포부 / Tự giới thiệu và mục tiêu">
        <div className="bg-warning/5 border border-warning/30 rounded-md p-3 text-xs space-y-1">
          <p>
            <strong>여기는 베트남어로 편하게 써주셔도 됩니다.</strong> 한국어로
            번역·정리는 우리가 합니다.
          </p>
          <p className="text-muted-foreground">
            <strong>Phần này bạn có thể viết bằng tiếng Việt.</strong> Chúng
            tôi sẽ dịch và chỉnh sửa.
          </p>
          <p className="text-muted-foreground mt-2">
            예시 / Ví dụ: 요양보호사가 되고 싶은 이유, 본인의 강점, 가족
            중 어르신을 돌봤던 경험, 교육·실습 중 인상 깊었던 일 등.
            <br />
            Ví dụ: Lý do muốn trở thành điều dưỡng viên, điểm mạnh của bản
            thân, kinh nghiệm chăm sóc người lớn tuổi trong gia đình, kỷ
            niệm trong quá trình học·thực tập.
          </p>
        </div>
        <textarea
          value={narrative_raw}
          onChange={(e) => setNarrative(e.target.value)}
          rows={10}
          className={inputCls + " font-normal"}
          placeholder="자유롭게 작성해주세요. / Hãy viết tự do."
        />
        <p className="text-xs text-muted-foreground text-right">
          {narrative_raw.length} 자
        </p>
      </Section>

      {result && !result.ok && (
        <div className="bg-destructive/5 border border-destructive/30 rounded-md p-3 text-sm text-destructive">
          저장 실패: {result.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full h-12 rounded-md bg-primary text-primary-foreground font-semibold text-base disabled:opacity-60"
      >
        {pending ? "제출 중... / Đang gửi..." : "제출 / Gửi"}
      </button>
    </form>
  );
}

// =============================================================================
// 작은 컴포넌트
// =============================================================================

const inputCls =
  "w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card rounded-lg border border-border p-4 space-y-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  labelVi,
  hint,
  children,
}: {
  label: string;
  labelVi: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium block">
        {label}
        <span className="ml-2 text-xs text-muted-foreground font-normal">
          {labelVi}
        </span>
      </label>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

function ListGuide({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
      {children}
    </p>
  );
}

function AddBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs text-primary hover:underline"
    >
      + 추가 / Thêm
    </button>
  );
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2 rounded-md border border-input text-muted-foreground hover:text-destructive hover:border-destructive/40"
      title="삭제"
    >
      ✕
    </button>
  );
}
