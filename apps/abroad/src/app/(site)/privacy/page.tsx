/**
 * /privacy — 개인정보처리방침.
 * 유학 지원 특성상 여권·학력·재정 정보까지 다루므로 수집 항목을 구체적으로 밝힌다.
 */

import type { Metadata } from "next";

import { Article, LegalPage } from "@/components/legal-page";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: "개인정보처리방침 | GLOCARE",
  description: "글로케어의 개인정보 수집·이용·보관에 관한 방침입니다.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="이용 정책"
      title="개인정보처리방침"
      updatedAt="시행일 2026-08-10"
    >
      <p className="legal-lead">
        {COMPANY.name}(이하 &ldquo;회사&rdquo;)는 이용자의 개인정보를 중요하게
        생각하며, 개인정보 보호법 등 관련 법령을 준수합니다.
      </p>

      <Article no="제1조" title="수집하는 개인정보 항목">
        <ol>
          <li>
            <strong>회원가입·상담</strong> — 이름, 이메일, 연락처, 거주 지역,
            관심 학과.
          </li>
          <li>
            <strong>유학 지원 서류 작성</strong> — 여권 정보, 생년월일, 국적,
            주소, 학력 사항, 가족 사항, 어학 성적, 재정보증인 정보, 증명사진 및
            서명.
          </li>
          <li>
            <strong>발급 서류 대행</strong> — 대행에 필요한 신분 확인 정보 및
            제출 서류 사본.
          </li>
          <li>
            <strong>결제</strong> — 결제 승인 정보. 카드번호 등 결제 수단 정보는
            결제대행사(토스페이먼츠)가 처리하며 회사는 저장하지 않습니다.
          </li>
        </ol>
      </Article>

      <Article no="제2조" title="수집 및 이용 목적">
        <ol>
          <li>대학 지원서 및 제출 서류의 작성·제출 대행</li>
          <li>발급 서류 대행 및 결과물 전달</li>
          <li>상담 응대 및 협력 유학센터 연결</li>
          <li>결제 처리, 환불 및 분쟁 대응</li>
        </ol>
      </Article>

      <Article no="제3조" title="보유 및 이용 기간">
        <ol>
          <li>
            회원 탈퇴 시 지체 없이 파기합니다. 다만 관계 법령이 정한 기간 동안은
            보관합니다.
          </li>
          <li>
            전자상거래법에 따라 계약·청약철회 기록 5년, 대금 결제 기록 5년,
            소비자 불만·분쟁 처리 기록 3년을 보관합니다.
          </li>
        </ol>
      </Article>

      <Article no="제4조" title="제3자 제공">
        <p>
          회사는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 다만
          유학 지원 절차상 아래 기관에 필요한 범위에서 제공합니다.
        </p>
        <ol>
          <li>
            <strong>지원 대학</strong> — 입학 심사에 필요한 지원서 및 제출 서류
          </li>
          <li>
            <strong>협력 유학센터</strong> — 이용자가 상담을 신청한 센터에 한해
            연락처 및 상담 내용
          </li>
          <li>
            <strong>결제대행사</strong> — 결제 처리 및 환불에 필요한 거래 정보
          </li>
        </ol>
      </Article>

      <Article no="제5조" title="이용자의 권리">
        <p>
          이용자는 언제든지 자신의 개인정보를 열람·정정·삭제하거나 처리 정지를
          요구할 수 있습니다. 로그인 후 정보 입력 화면에서 직접 수정하거나
          고객센터로 요청할 수 있습니다.
        </p>
      </Article>

      <Article no="제6조" title="개인정보 보호책임자">
        <dl className="legal-dl">
          <div>
            <dt>책임자</dt>
            <dd>{COMPANY.privacyOfficer}</dd>
          </div>
          <div>
            <dt>이메일</dt>
            <dd>{COMPANY.email}</dd>
          </div>
          <div>
            <dt>유선전화번호</dt>
            <dd className="gc-mono">{COMPANY.tel}</dd>
          </div>
          <div>
            <dt>주소</dt>
            <dd>{COMPANY.address}</dd>
          </div>
        </dl>
      </Article>
    </LegalPage>
  );
}
