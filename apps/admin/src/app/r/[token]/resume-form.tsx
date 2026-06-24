"use client";

import { useState, useTransition } from "react";
import {
  saveResumeDraft,
  submitResumeDraft,
  uploadResumePhoto,
} from "./actions";
import type { ResumeDraftDataInput } from "@/lib/validators";

type EduRow = {
  school: string;
  major: string;
  start_year: string;
  end_year: string;
  status: string;
};
type CarRow = {
  workplace: string;
  role: string;
  detail: string;
  period: string;
  status: string;
};
type CertRow = { name: string; date: string; detail: string };
type SkillRow = { name: string; detail: string; level: string };
type ActRow = { name: string; detail: string; period: string };

const emptyEdu: EduRow = {
  school: "",
  major: "",
  start_year: "",
  end_year: "",
  status: "",
};
const emptyCar: CarRow = {
  workplace: "",
  role: "",
  detail: "",
  period: "",
  status: "",
};
const emptyCert: CertRow = { name: "", date: "", detail: "" };
const emptySkill: SkillRow = { name: "", detail: "", level: "" };
const emptyAct: ActRow = { name: "", detail: "", period: "" };

export function ResumeForm({
  token,
  initial,
  hasPhoto: hasPhotoInitial,
  alreadySubmitted,
}: {
  token: string;
  initial: ResumeDraftDataInput;
  hasPhoto: boolean;
  alreadySubmitted: boolean;
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
      : [
          { name: "요양보호사 자격증", date: "", detail: "" },
          { name: "TOPIK", date: "", detail: "" },
        ]
  );
  const [skills, setSkills] = useState<SkillRow[]>(
    initial.skills?.length
      ? (initial.skills as SkillRow[])
      : [
          { name: "베트남어", detail: "모국어", level: "모국어" },
          { name: "한국어", detail: "", level: "" },
        ]
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
  type Result =
    | null
    | { kind: "save" | "submit"; ok: true }
    | { kind: "save" | "submit"; ok: false; error: string };
  const [result, setResult] = useState<Result>(null);
  const [hasSubmitted, setHasSubmitted] = useState(alreadySubmitted);

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
        alert(`사진 업로드 실패 / Tải ảnh thất bại: ${r.error}`);
        setPhotoPreview(null);
      }
    };
    reader.readAsDataURL(file);
  }

  function buildPayload(): ResumeDraftDataInput {
    return {
      name_vi,
      name_kr,
      birth_date,
      phone,
      email,
      address,
      one_liner,
      narrative_raw,
      narrative_polished: initial.narrative_polished ?? "",
      educations: educations.filter(
        (r) => r.school || r.major || r.start_year || r.end_year
      ),
      careers: careers.filter((r) => r.workplace || r.role || r.detail),
      certifications: certifications.filter((r) => r.name),
      skills: skills.filter((r) => r.name || r.detail),
      activities: activities.filter((r) => r.name || r.detail),
    };
  }

  function handleSave() {
    if (pending) return;
    startTransition(async () => {
      const r = await saveResumeDraft(token, buildPayload());
      if (r.ok) {
        setResult({ kind: "save", ok: true });
      } else {
        setResult({ kind: "save", ok: false, error: r.error });
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    if (!name_kr.trim() && !name_vi.trim()) {
      alert("이름을 입력해주세요 / Vui lòng nhập tên");
      return;
    }
    // 필수 검증 — 학력 1개 이상, 자격증 1개 이상
    const hasEdu = educations.some((r) => r.school || r.major);
    const hasCert = certifications.some((r) => r.name);
    if (!hasEdu) {
      alert("학력은 최소 1개 입력해주세요 / Học vấn cần ít nhất 1 mục");
      return;
    }
    if (!hasCert) {
      alert("자격증은 최소 1개 입력해주세요 / Chứng chỉ cần ít nhất 1 mục");
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
      const r = await submitResumeDraft(token, buildPayload());
      if (r.ok) {
        setResult({ kind: "submit", ok: true });
        setHasSubmitted(true);
      } else {
        setResult({ kind: "submit", ok: false, error: r.error });
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 결과 banner */}
      {result?.ok && (
        <div className="bg-success/5 border border-success/30 rounded-lg p-3 text-sm">
          <p className="font-medium text-success">
            {result.kind === "submit" ? "제출 완료 / Đã gửi" : "임시 저장 완료 / Đã lưu"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {result.kind === "submit"
              ? "내용이 접수되었습니다. 링크 유효기간(7일) 안에는 계속 수정·재제출할 수 있습니다. / Nội dung đã được tiếp nhận. Trong vòng 7 ngày, bạn vẫn có thể chỉnh sửa và gửi lại."
              : "지금까지 작성한 내용이 저장되었습니다. 나중에 같은 링크로 돌아와서 이어 작성할 수 있습니다. / Nội dung đã được lưu. Bạn có thể quay lại link này sau để tiếp tục."}
          </p>
        </div>
      )}

      {hasSubmitted && !result && (
        <div className="bg-info/5 border border-info/30 rounded-lg p-3 text-sm">
          <p className="font-medium">이미 한 번 제출하셨어요 / Bạn đã từng gửi</p>
          <p className="text-xs text-muted-foreground mt-1">
            수정 후 다시 제출하시면 가장 최근 내용으로 반영됩니다. / Sau khi
            chỉnh sửa và gửi lại, nội dung mới nhất sẽ được áp dụng.
          </p>
        </div>
      )}

      {/* 가이드 */}
      <div className="bg-info/5 border border-info/30 rounded-lg p-4 text-sm space-y-2">
        <p className="font-medium">작성 안내 / Hướng dẫn điền</p>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>
            대부분 한국어로 작성해주세요. / Vui lòng điền chủ yếu bằng tiếng Hàn.
          </li>
          <li>
            중간에 <span className="font-medium">&quot;임시 저장&quot;</span>을
            누르면 나중에 같은 링크로 이어 작성 가능. 링크는 7일간 유효. /
            Nhấn <span className="font-medium">&quot;Lưu tạm&quot;</span> để có
            thể quay lại link sau (link có hiệu lực 7 ngày).
          </li>
          <li>
            마지막 &quot;자기소개 및 포부&quot;는 베트남어로 편하게 써주셔도 됩니다.
            / Phần &quot;Tự giới thiệu&quot; cuối có thể viết bằng tiếng Việt.
          </li>
          <li>
            <span className="text-destructive font-medium">학력·자격증</span>은
            필수입니다. 나머지는 선택. / Học vấn và Chứng chỉ là{" "}
            <span className="text-destructive font-medium">bắt buộc</span>. Các
            mục khác tuỳ chọn.
          </li>
          <li>
            &quot;+추가&quot; 버튼으로 여러 항목을 등록할 수 있습니다. / Có thể
            thêm nhiều mục bằng nút &quot;+추가&quot;.
          </li>
        </ul>
      </div>


      <Section title="증명사진 / Ảnh thẻ">
        <p className="text-xs text-muted-foreground">
          JPEG / PNG / WebP, 최대 5MB. 이력서 좌측 상단에 들어갑니다.
          <br />
          JPEG / PNG / WebP, tối đa 5MB. Sẽ được đặt ở góc trên bên trái của CV.
        </p>
        <div className="flex items-start gap-3">
          {(photoPreview || hasPhoto) && (
            <div className="size-28 rounded-md border border-border bg-muted overflow-hidden flex items-center justify-center shrink-0">
              {photoPreview ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={photoPreview}
                  alt="preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs text-muted-foreground">업로드됨</span>
              )}
            </div>
          )}
          <label className="cursor-pointer">
            <span className="inline-flex items-center gap-1 h-11 rounded-md border border-input bg-background px-4 text-sm hover:bg-muted/30">
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
          hint="예 / Ví dụ: NGUYEN THI VAN ANH"
        >
          <input
            value={name_vi}
            onChange={(e) => setNameVi(e.target.value.toUpperCase())}
            className={inputCls}
            placeholder="NGUYEN THI VAN ANH"
            maxLength={60}
          />
        </Field>
        <Field
          label="한글 이름"
          labelVi="Tên tiếng Hàn"
          hint="예 / Ví dụ: 응우옌 티 반 안"
        >
          <input
            value={name_kr}
            onChange={(e) => setNameKr(e.target.value)}
            className={inputCls}
            placeholder="응우옌 티 반 안"
            maxLength={30}
          />
        </Field>
        <Field
          label="생년월일"
          labelVi="Ngày sinh"
          hint="예 / Ví dụ: 2002년 11월 3일 / 2002-11-03"
        >
          <input
            value={birth_date}
            onChange={(e) => setBirthDate(e.target.value)}
            className={inputCls}
            placeholder="2002년 11월 3일"
            maxLength={30}
          />
        </Field>
        <Field
          label="한국 전화번호"
          labelVi="Số điện thoại Hàn Quốc"
          hint="예 / Ví dụ: 010-1234-5678"
        >
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputCls}
            placeholder="010-1234-5678"
            maxLength={30}
          />
        </Field>
        <Field
          label="이메일"
          labelVi="Email"
          hint="예 / Ví dụ: example@gmail.com"
        >
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
            placeholder="example@gmail.com"
            type="email"
            maxLength={100}
          />
        </Field>
        <Field
          label="한국 내 주소"
          labelVi="Địa chỉ ở Hàn Quốc"
          hint="이사 가능하다면 끝에 '(근무처 근처로 이사가능합니다)' 추가 / Nếu có thể chuyển nhà gần nơi làm thì thêm cụm '(근무처 근처로 이사가능합니다)' ở cuối"
        >
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={inputCls}
            placeholder="서울시 광진구 능동로 120, 창의관 202호 (근무처 근처로 이사가능합니다)"
            maxLength={200}
          />
        </Field>
        <Field
          label="한 줄 자기소개"
          labelVi="Một câu giới thiệu bản thân"
          hint="이력서 맨 위에 들어갑니다 / Sẽ hiển thị ở đầu CV"
        >
          <input
            value={one_liner}
            onChange={(e) => setOneLiner(e.target.value)}
            className={inputCls}
            placeholder="어르신을 따뜻한 마음으로 돌보는 요양보호사가 되고 싶습니다."
            maxLength={120}
          />
        </Field>
      </Section>

      <Section
        title="학력 / Học vấn"
        required
      >
        <ListGuide>
          학교명 / 전공 / 입학년도 / 졸업년도 / 졸업여부 순으로 작성해주세요. / Điền theo
          thứ tự: Trường / Chuyên ngành / Năm nhập học / Năm tốt nghiệp / Tình trạng.
        </ListGuide>
        {educations.map((row, i) => (
          <RowBox
            key={i}
            onRemove={
              educations.length > 1
                ? () =>
                    setEducations((prev) => prev.filter((_, j) => j !== i))
                : undefined
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SubField label="학교명" labelVi="Trường">
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
                  placeholder="한국대학교"
                />
              </SubField>
              <SubField label="전공" labelVi="Chuyên ngành">
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
                  placeholder="경영학과"
                />
              </SubField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <SubField label="입학년도" labelVi="Năm nhập học">
                <input
                  value={row.start_year}
                  onChange={(e) =>
                    setEducations((prev) =>
                      prev.map((r, j) =>
                        j === i ? { ...r, start_year: e.target.value } : r
                      )
                    )
                  }
                  className={inputCls}
                  placeholder="2020"
                />
              </SubField>
              <SubField label="졸업년도" labelVi="Năm tốt nghiệp">
                <input
                  value={row.end_year}
                  onChange={(e) =>
                    setEducations((prev) =>
                      prev.map((r, j) =>
                        j === i ? { ...r, end_year: e.target.value } : r
                      )
                    )
                  }
                  className={inputCls}
                  placeholder="2024"
                />
              </SubField>
              <SubField label="상태" labelVi="Tình trạng">
                <select
                  value={row.status}
                  onChange={(e) =>
                    setEducations((prev) =>
                      prev.map((r, j) =>
                        j === i ? { ...r, status: e.target.value } : r
                      )
                    )
                  }
                  className={inputCls}
                >
                  <option value="">선택 / Chọn</option>
                  <option value="졸업">졸업 / Đã tốt nghiệp</option>
                  <option value="졸업예정">
                    졸업예정 / Sắp tốt nghiệp
                  </option>
                  <option value="재학중">재학중 / Đang học</option>
                </select>
              </SubField>
            </div>
          </RowBox>
        ))}
        <AddBtn onClick={() => setEducations((p) => [...p, { ...emptyEdu }])} />
      </Section>

      <Section title="경력 (선택) / Kinh nghiệm (Tuỳ chọn)">
        <ListGuide>
          편의점·식당·공장 등 모든 알바 / 경력도 포함해서 적어주세요. / Hãy điền tất
          cả: kể cả việc làm thêm tại cửa hàng tiện lợi, quán ăn, công xưởng...
        </ListGuide>
        {careers.map((row, i) => (
          <RowBox
            key={i}
            onRemove={() =>
              setCareers((prev) => prev.filter((_, j) => j !== i))
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SubField label="근무처" labelVi="Nơi làm">
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
                  placeholder="CU 편의점"
                />
              </SubField>
              <SubField label="직책" labelVi="Vị trí">
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
                  placeholder="주간 아르바이트"
                />
              </SubField>
            </div>
            <SubField label="업무 상세" labelVi="Mô tả công việc">
              <textarea
                value={row.detail}
                onChange={(e) =>
                  setCareers((p) =>
                    p.map((r, j) =>
                      j === i ? { ...r, detail: e.target.value } : r
                    )
                  )
                }
                rows={2}
                className={textareaCls}
                placeholder="계산, 진열, 재고 관리 등"
                maxLength={500}
              />
            </SubField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SubField label="근무기간 (년월)" labelVi="Thời gian (năm/tháng)">
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
                  placeholder="2022년 3월 ~ 현재"
                />
              </SubField>
              <SubField label="상태" labelVi="Tình trạng">
                <select
                  value={row.status}
                  onChange={(e) =>
                    setCareers((p) =>
                      p.map((r, j) =>
                        j === i ? { ...r, status: e.target.value } : r
                      )
                    )
                  }
                  className={inputCls}
                >
                  <option value="">선택 / Chọn</option>
                  <option value="재직">재직 / Đang làm</option>
                  <option value="퇴사">퇴사 / Đã nghỉ</option>
                </select>
              </SubField>
            </div>
          </RowBox>
        ))}
        <AddBtn onClick={() => setCareers((p) => [...p, { ...emptyCar }])} />
      </Section>

      <Section title="자격증 / Chứng chỉ" required>
        <ListGuide>
          <strong>요양보호사 자격증과 TOPIK은 필수로 들어갑니다.</strong>{" "}
          발급일/상세도 채워주세요. /{" "}
          <strong>
            Chứng chỉ Điều dưỡng và TOPIK là bắt buộc.
          </strong>{" "}
          Vui lòng điền cả ngày cấp và chi tiết.
        </ListGuide>
        {certifications.map((row, i) => (
          <RowBox
            key={i}
            onRemove={
              certifications.length > 1
                ? () =>
                    setCertifications((prev) =>
                      prev.filter((_, j) => j !== i)
                    )
                : undefined
            }
          >
            <SubField label="자격증 이름" labelVi="Tên chứng chỉ">
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
                placeholder="요양보호사 자격증 / TOPIK 4급 등"
              />
            </SubField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SubField label="발급일" labelVi="Ngày cấp">
                <input
                  value={row.date}
                  onChange={(e) =>
                    setCertifications((p) =>
                      p.map((r, j) =>
                        j === i ? { ...r, date: e.target.value } : r
                      )
                    )
                  }
                  className={inputCls}
                  placeholder="2025년 8월"
                />
              </SubField>
              <SubField
                label="상세"
                labelVi="Chi tiết"
                hint="발급기관 등 / Cơ quan cấp..."
              >
                <input
                  value={row.detail}
                  onChange={(e) =>
                    setCertifications((p) =>
                      p.map((r, j) =>
                        j === i ? { ...r, detail: e.target.value } : r
                      )
                    )
                  }
                  className={inputCls}
                  placeholder="한국보건의료인국가시험원"
                />
              </SubField>
            </div>
          </RowBox>
        ))}
        <AddBtn
          onClick={() =>
            setCertifications((p) => [...p, { ...emptyCert }])
          }
        />
      </Section>

      <Section title="기술 · 어학 (선택) / Kỹ năng · Ngoại ngữ (Tuỳ chọn)">
        <ListGuide>
          <strong>베트남어와 한국어는 기본으로 들어갑니다.</strong> 다른 기술도
          있으면 추가해주세요. /{" "}
          <strong>Tiếng Việt và tiếng Hàn được điền sẵn.</strong> Hãy thêm các
          kỹ năng khác nếu có.
        </ListGuide>
        {skills.map((row, i) => (
          <RowBox
            key={i}
            onRemove={
              skills.length > 1
                ? () => setSkills((prev) => prev.filter((_, j) => j !== i))
                : undefined
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <SubField label="명칭" labelVi="Tên">
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
                  placeholder="한국어"
                />
              </SubField>
              <SubField label="상세" labelVi="Chi tiết">
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
                  placeholder="일상대화 가능"
                />
              </SubField>
              <SubField label="수준" labelVi="Mức độ">
                <input
                  value={row.level}
                  onChange={(e) =>
                    setSkills((p) =>
                      p.map((r, j) =>
                        j === i ? { ...r, level: e.target.value } : r
                      )
                    )
                  }
                  className={inputCls}
                  placeholder="중급 / 능숙 / 모국어"
                />
              </SubField>
            </div>
          </RowBox>
        ))}
        <AddBtn onClick={() => setSkills((p) => [...p, { ...emptySkill }])} />
      </Section>

      <Section title="기타 활동 (선택) / Hoạt động khác (Tuỳ chọn)">
        <ListGuide>
          봉사·동아리·학우회 등. 활동명 / 상세 / 기간 순으로 작성해주세요. /
          Tình nguyện, câu lạc bộ, hội sinh viên... Điền theo thứ tự: Tên / Chi
          tiết / Thời gian.
        </ListGuide>
        {activities.map((row, i) => (
          <RowBox
            key={i}
            onRemove={() =>
              setActivities((prev) => prev.filter((_, j) => j !== i))
            }
          >
            <SubField label="활동명" labelVi="Tên hoạt động">
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
                placeholder="요양원 봉사활동"
              />
            </SubField>
            <SubField label="상세" labelVi="Chi tiết">
              <textarea
                value={row.detail}
                onChange={(e) =>
                  setActivities((p) =>
                    p.map((r, j) =>
                      j === i ? { ...r, detail: e.target.value } : r
                    )
                  )
                }
                rows={2}
                className={textareaCls}
                placeholder="매주 일요일 어르신 식사 보조 및 청소 등"
                maxLength={500}
              />
            </SubField>
            <SubField label="기간" labelVi="Thời gian">
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
                placeholder="2025년 1월 ~ 2026년 3월"
              />
            </SubField>
          </RowBox>
        ))}
        <AddBtn onClick={() => setActivities((p) => [...p, { ...emptyAct }])} />
      </Section>

      <Section title="자기소개 및 포부 / Tự giới thiệu và mục tiêu">
        <div className="bg-warning/5 border border-warning/30 rounded-md p-3 text-xs space-y-1">
          <p>
            <strong>여기는 베트남어로 편하게 써주셔도 됩니다.</strong> 한국어로
            번역·정리는 우리가 합니다.
          </p>
          <p className="text-muted-foreground">
            <strong>Phần này bạn có thể viết bằng tiếng Việt.</strong> Chúng tôi
            sẽ dịch và chỉnh sửa.
          </p>
          <p className="text-muted-foreground mt-2">
            예시 / Ví dụ: 요양보호사가 되고 싶은 이유, 본인의 강점, 가족 중
            어르신을 돌봤던 경험, 교육·실습 중 인상 깊었던 일 등. / Lý do muốn
            trở thành điều dưỡng viên, điểm mạnh của bản thân, kinh nghiệm chăm
            sóc người lớn tuổi, kỷ niệm trong quá trình học·thực tập.
          </p>
        </div>
        <textarea
          value={narrative_raw}
          onChange={(e) => setNarrative(e.target.value)}
          rows={12}
          className={textareaCls + " font-normal"}
          placeholder="자유롭게 작성해주세요. / Hãy viết tự do."
          maxLength={3000}
        />
        <p className="text-xs text-muted-foreground text-right">
          {narrative_raw.length} / 3000 자 (권장 500–1500 / Khuyên dùng 500–1500)
        </p>
      </Section>

      {result && !result.ok && (
        <div className="bg-destructive/5 border border-destructive/30 rounded-md p-3 text-sm text-destructive">
          {result.kind === "submit" ? "제출 실패 / Gửi thất bại" : "저장 실패 / Lưu thất bại"}: {result.error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="h-12 rounded-md border border-input bg-background font-medium text-sm disabled:opacity-60 hover:bg-muted/30"
        >
          {pending ? "..." : "임시 저장 / Lưu tạm"}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="h-12 rounded-md bg-primary text-primary-foreground font-semibold text-base disabled:opacity-60"
        >
          {pending
            ? "제출 중... / Đang gửi..."
            : hasSubmitted
              ? "다시 제출 / Gửi lại"
              : "제출 / Gửi"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        링크는 7일간 유효합니다. 그 전까지는 임시 저장 + 재제출이 가능합니다. /
        Link có hiệu lực 7 ngày. Trong thời gian đó bạn có thể lưu tạm và gửi
        lại nhiều lần.
      </p>
    </form>
  );
}

// =============================================================================
// 작은 컴포넌트
// =============================================================================

const inputCls =
  "w-full h-11 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

const textareaCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

function Section({
  title,
  required,
  children,
}: {
  title: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card rounded-lg border border-border p-4 space-y-3">
      <h2 className="text-base font-semibold flex items-center gap-2">
        {title}
        {required && (
          <span className="text-xs font-medium text-destructive">
            * 필수 / Bắt buộc
          </span>
        )}
      </h2>
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

function SubField({
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
      <label className="text-xs font-medium block text-muted-foreground">
        <span className="text-foreground">{label}</span>
        <span className="ml-1.5">{labelVi}</span>
      </label>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

function RowBox({
  children,
  onRemove,
}: {
  children: React.ReactNode;
  onRemove?: () => void;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 space-y-3 relative">
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-2 right-2 size-7 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/5 inline-flex items-center justify-center text-sm"
          title="삭제 / Xoá"
          aria-label="삭제 / Xoá"
        >
          ✕
        </button>
      )}
    </div>
  );
}

function ListGuide({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] text-muted-foreground bg-muted/40 rounded-md px-3 py-2 leading-relaxed">
      {children}
    </p>
  );
}

function AddBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 h-9 px-3 rounded-md border border-dashed border-input text-xs text-primary hover:bg-primary/5"
    >
      + 추가 / Thêm
    </button>
  );
}
