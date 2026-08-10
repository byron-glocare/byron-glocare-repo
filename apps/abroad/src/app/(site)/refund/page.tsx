/**
 * /refund — 취소·환불 규정 (무형 상품).
 *
 * 판매 상품은 "발급 서류 대행"으로, 배송이 없는 용역이다.
 * 따라서 환불 기준은 배송 여부가 아니라 **대행 착수 단계**를 기준으로 나눈다
 * (주문 상태: paid → assigned/contacted → in_progress → issued → shipped/done).
 *
 * 카드사 심사용 결제경로 파일의 "환불규정 캡처"(토스 가이드 8·9쪽) 대상 페이지.
 */

import type { Metadata } from "next";

import { Article, LegalPage } from "@/components/legal-page";
import { COMPANY, companyField } from "@/lib/company";

export const metadata: Metadata = {
  title: "취소·환불 규정 | GLOCARE",
  description:
    "글로케어 발급 서류 대행 서비스의 결제 취소 및 환불 기준을 안내합니다.",
};

export default function RefundPage() {
  return (
    <LegalPage
      eyebrow="이용 정책"
      title="취소 · 환불 규정"
      updatedAt="시행일 2026-08-10"
    >
      <p className="legal-lead">
        본 규정은 {COMPANY.name}(이하 &ldquo;회사&rdquo;)가 제공하는 발급 서류
        대행 서비스(이하 &ldquo;서비스&rdquo;)의 결제 취소 및 환불 기준을
        정합니다. 서비스는 배송이 따르지 않는 무형의 용역이므로, 환불 기준은
        회사의 <strong>대행 착수 단계</strong>를 기준으로 산정합니다.
      </p>

      <Article no="제1조" title="적용 범위">
        <p>
          본 규정은 회사 홈페이지를 통해 결제한 발급 서류 대행 주문에
          적용됩니다. 무료로 제공되는 대학 정보 조회, 지원 서류 작성, 상담
          서비스는 결제가 발생하지 않으므로 본 규정의 적용 대상이 아닙니다.
        </p>
      </Article>

      <Article no="제2조" title="청약철회 및 환불 기준">
        <p>
          이용자는 아래 기준에 따라 결제 취소 및 환불을 요청할 수 있습니다.
          환불액은 서류 1건 단위로 산정하며, 주문에 여러 건이 포함된 경우 각
          건의 진행 단계에 따라 개별 계산합니다.
        </p>
        <table className="legal-table">
          <thead>
            <tr>
              <th>진행 단계</th>
              <th>환불 범위</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>결제 완료 후 담당자 배정 전</td>
              <td>
                <strong>전액 환불</strong>
              </td>
            </tr>
            <tr>
              <td>담당자 배정 · 발급기관 문의 단계</td>
              <td>
                결제 금액의 <strong>90% 환불</strong> (실제 소요된 행정 비용
                10% 공제)
              </td>
            </tr>
            <tr>
              <td>발급 진행 중 (관공서 접수 완료)</td>
              <td>
                이미 납부한 <strong>발급 수수료·공증료 등 실비를 공제한 잔액
                환불</strong>
              </td>
            </tr>
            <tr>
              <td>서류 발급 완료 · 전달 이후</td>
              <td>
                용역이 완료되었으므로 <strong>환불 불가</strong>
              </td>
            </tr>
          </tbody>
        </table>
        <p className="legal-note">
          단, 아래 제3조에 해당하는 회사 귀책 사유가 있는 경우에는 진행 단계와
          무관하게 전액 환불합니다.
        </p>
      </Article>

      <Article no="제3조" title="회사 귀책 사유에 따른 전액 환불">
        <p>다음의 경우 진행 단계와 관계없이 결제 금액을 전액 환불합니다.</p>
        <ol>
          <li>회사의 사정으로 서비스 제공이 불가능하게 된 경우</li>
          <li>
            안내한 처리 기간을 회사의 귀책으로 현저히 초과하고, 이용자가 이를
            사유로 취소를 요청한 경우
          </li>
          <li>회사의 과실로 잘못된 서류가 발급된 경우</li>
          <li>결제 시스템 오류로 중복 결제 또는 오결제가 발생한 경우</li>
        </ol>
      </Article>

      <Article no="제4조" title="환불이 제한되는 경우">
        <p>
          다음의 경우 환불이 제한될 수 있습니다. 이 경우에도 이미 지출된 실비를
          제외한 잔액은 환불합니다.
        </p>
        <ol>
          <li>
            이용자가 제공한 정보가 사실과 달라 서류 발급이 불가능해진 경우
          </li>
          <li>
            이용자가 필요한 서류·정보를 회사의 요청 후 상당한 기간 내에
            제출하지 않아 진행이 중단된 경우
          </li>
          <li>
            발급기관의 정책·현지 사정으로 발급이 거부되었으나 이미 접수 수수료가
            납부된 경우
          </li>
        </ol>
      </Article>

      <Article no="제5조" title="환불 신청 방법 및 처리 기간">
        <ol>
          <li>
            환불은 아래 고객센터로 요청하거나, 로그인 후 주문 상세 화면에서
            취소를 요청할 수 있습니다.
          </li>
          <li>
            회사는 환불 요청을 접수한 날부터 <strong>3영업일 이내</strong>에
            환불 사유와 금액을 확인하여 안내합니다.
          </li>
          <li>
            환불은 원결제 수단으로 처리합니다. 신용카드 결제는 카드사 승인 취소로
            진행되며, 카드사 정책에 따라 취소 반영까지{" "}
            <strong>영업일 기준 3~5일</strong>이 소요될 수 있습니다.
          </li>
        </ol>
      </Article>

      <Article no="제6조" title="고객센터">
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
          <div>
            <dt>이메일</dt>
            <dd>{COMPANY.email}</dd>
          </div>
        </dl>
      </Article>
    </LegalPage>
  );
}
