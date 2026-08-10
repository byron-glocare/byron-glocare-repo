/**
 * /terms — 이용약관.
 * 결제가 발생하는 서비스(발급 서류 대행)의 계약 조건을 담는다.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { Article, LegalPage } from "@/components/legal-page";
import { COMPANY, companyField } from "@/lib/company";

export const metadata: Metadata = {
  title: "이용약관 | GLOCARE",
  description: "글로케어 서비스 이용약관입니다.",
};

export default function TermsPage() {
  return (
    <LegalPage eyebrow="이용 정책" title="이용약관" updatedAt="시행일 2026-08-10">
      <p className="legal-lead">
        본 약관은 {COMPANY.name}(이하 &ldquo;회사&rdquo;)가 운영하는
        youstudyinkorea.com(이하 &ldquo;사이트&rdquo;)에서 제공하는 서비스의
        이용 조건과 절차, 회사와 이용자의 권리·의무를 정합니다.
      </p>

      <Article no="제1조" title="용어의 정의">
        <ol>
          <li>
            &ldquo;서비스&rdquo;란 회사가 사이트를 통해 제공하는 한국 대학 정보
            조회, 지원 서류 작성 지원, 발급 서류 대행, 유학 상담 연결을
            말합니다.
          </li>
          <li>
            &ldquo;이용자&rdquo;란 사이트에 접속하여 서비스를 이용하는 회원 및
            비회원을 말합니다.
          </li>
          <li>
            &ldquo;유료 서비스&rdquo;란 결제가 필요한 서비스로, 현재는 발급 서류
            대행이 이에 해당합니다.
          </li>
        </ol>
      </Article>

      <Article no="제2조" title="회원가입">
        <ol>
          <li>
            회원가입은 구글 계정 인증으로 이루어지며, 이용자가 본 약관에 동의함
            으로써 이용계약이 성립합니다.
          </li>
          <li>
            회사는 만 14세 미만이거나 타인의 명의를 도용한 경우 가입을 거부하거나
            사후에 이용계약을 해지할 수 있습니다.
          </li>
        </ol>
      </Article>

      <Article no="제3조" title="서비스의 내용">
        <ol>
          <li>
            <strong>무료 서비스</strong> — 대학·학과 정보 조회, 지원서 작성,
            제출 서류 관리, 상담 신청.
          </li>
          <li>
            <strong>유료 서비스</strong> — 발급 서류 대행. 이용자를 대신하여
            졸업증명서·성적증명서·가족관계증명서 등 관공서·학교 발급 서류를
            신청·수령·전달합니다.
          </li>
          <li>
            회사는 대학의 입학 허가나 비자 발급을 보증하지 않습니다. 최종 심사는
            해당 대학과 출입국·외국인관서의 권한입니다.
          </li>
        </ol>
      </Article>

      <Article no="제4조" title="결제">
        <ol>
          <li>
            유료 서비스의 이용료는 주문 화면에 표시된 금액이며, 부가세가 포함된
            금액입니다.
          </li>
          <li>결제 수단은 신용·체크카드 등 사이트가 제공하는 방법에 따릅니다.</li>
          <li>
            현지 사정으로 대리 발급이 어려워 추가 비용이 발생하는 경우, 회사는
            사전에 이용자에게 안내하고 동의를 받은 뒤 진행합니다.
          </li>
        </ol>
      </Article>

      <Article no="제5조" title="취소 및 환불">
        <p>
          결제 취소와 환불은 별도로 정한{" "}
          <Link href="/refund">취소·환불 규정</Link>에 따릅니다.
        </p>
      </Article>

      <Article no="제6조" title="이용자의 의무">
        <ol>
          <li>
            이용자는 서류 발급에 필요한 정보를 정확하게 제공해야 하며, 허위 정보로
            발생한 불이익은 이용자가 부담합니다.
          </li>
          <li>
            이용자는 타인의 개인정보나 서류를 무단으로 사용해서는 안 됩니다.
          </li>
        </ol>
      </Article>

      <Article no="제7조" title="회사의 의무">
        <ol>
          <li>
            회사는 관련 법령을 준수하며, 안정적으로 서비스를 제공하기 위해
            노력합니다.
          </li>
          <li>
            회사는 이용자의 개인정보를 개인정보처리방침에 따라 보호합니다.
          </li>
        </ol>
      </Article>

      <Article no="제8조" title="책임의 한계">
        <ol>
          <li>
            천재지변, 발급기관의 정책 변경 등 회사의 통제를 벗어난 사유로 인한
            서비스 지연·중단에 대해서는 책임을 지지 않습니다.
          </li>
          <li>
            회사는 무료로 제공되는 서비스의 이용과 관련하여 발생한 손해에 대해
            책임을 지지 않습니다.
          </li>
        </ol>
      </Article>

      <Article no="제9조" title="분쟁의 해결">
        <p>
          본 약관과 관련한 분쟁은 대한민국 법을 준거법으로 하며, 관할 법원은
          민사소송법에 따릅니다.
        </p>
      </Article>

      <Article no="부칙" title="사업자 정보">
        <dl className="legal-dl">
          <div>
            <dt>상호명</dt>
            <dd>{COMPANY.name}</dd>
          </div>
          <div>
            <dt>대표자명</dt>
            <dd>{COMPANY.ceo}</dd>
          </div>
          <div>
            <dt>사업자등록번호</dt>
            <dd className="gc-mono">{COMPANY.businessNo}</dd>
          </div>
          <div>
            <dt>통신판매업신고번호</dt>
            <dd className="gc-mono">{companyField(COMPANY.mailOrderNo)}</dd>
          </div>
          <div>
            <dt>사업장주소</dt>
            <dd>{COMPANY.address}</dd>
          </div>
          <div>
            <dt>유선전화번호</dt>
            <dd className="gc-mono">{COMPANY.tel}</dd>
          </div>
        </dl>
      </Article>
    </LegalPage>
  );
}
