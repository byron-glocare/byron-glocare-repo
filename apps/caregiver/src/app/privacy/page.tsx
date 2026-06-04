import { getDict } from "@/lib/i18n";

export default async function PrivacyPage() {
  const t = await getDict();

  return (
    <div className="page-wrap" style={{ maxWidth: 760 }}>
      <div className="eyebrow">{t["privacy.title"]}</div>
      <h1 className="page-title">{t["privacy.title"]}</h1>
      <p
        className="page-desc"
        style={{ fontSize: "0.82rem", color: "var(--ink-xlight)" }}
      >
        공고일자: 2025년 9월 11일 · 시행일자: 2025년 9월 11일
      </p>

      <div
        style={{
          fontSize: "0.92rem",
          color: "var(--ink-mid)",
          lineHeight: 1.85,
          marginTop: "2rem",
        }}
      >
        <p
          style={{
            padding: "1rem 1.2rem",
            background: "var(--peach)",
            borderLeft: "3px solid var(--coral)",
            borderRadius: 8,
            marginBottom: "2rem",
            fontStyle: "italic",
          }}
        >
          ㈜글로케어는 사용자의 개인정보를 안전하게 보호하는 것을 가장 중요하게 생각합니다.
        </p>

        <Section title="1. 개인정보의 수집 목적 및 이용 목적">
          {`수집 목적: 회사는 계정 신청 및 서비스 이용을 위해 최소한의 정보를 수집합니다.
이용 목적: 이용자 식별, 부정 계정 방지, 무단 이용 방지, 회원 의사 확인, 민원 처리, 공지·연락, 이벤트, 맞춤형 서비스, 연령 기반 서비스, 인구통계학적 분석.`}
        </Section>

        <Section title="2. 개인정보 수집 항목 및 수집 방법">
          {`■ 계정 신청 시
- 필수: 이름, 성별, 연령대, 생년월일, 출생연도, 이메일
- 선택: 주소, 휴대전화, 비자 종류, 카카오 계정

■ 서비스 이용 과정에서 자동 생성
서비스 이용 기록, IP 주소, 기기 정보, 위반 기록, 성인 인증 값, 쿠키.

■ 기기 정보 상세
- PC 웹: OS 버전 (Windows, Mac), 브라우저 버전 (Chrome, Safari)
- 모바일 웹: 단말 OS 버전, 브라우저 버전`}
        </Section>

        <Section title="3. 개인정보 수집에 대한 동의">
          계정 가입 절차 중 체크박스 동의를 통해 수집에 동의합니다. 동의 박스 체크가 정보 수집에 대한 동의로 간주됩니다.
        </Section>

        <Section title="4. 개인정보의 제공 및 위탁">
          {`회사는 사용자의 사전 동의 없이 외부에 정보를 제공하지 않습니다.

■ 예외 사항
- 법령 요청 또는 수사 목적의 법적 절차에 따른 경우
- 사용자의 생명·안전을 위협하는 긴급 상황

■ 현재 상태
회사는 현재 사용자 정보를 제3자 처리자에게 위탁하지 않습니다.`}
        </Section>

        <Section title="5. 개인정보 열람, 정정">
          이용자는 서비스 로그인 후 &apos;마이 페이지&apos; 메뉴를 통해 계정 정보를 조회 또는 정정할 수 있습니다.
        </Section>

        <Section title="6. 개인정보의 보유 및 이용기간">
          {`■ 표준 보유 기간
계정 생성부터 회원 탈퇴까지 보유합니다.

■ 탈퇴 절차
이용자는 로그인 후 '계정 정보' → '탈퇴' 클릭으로 동의 철회할 수 있으며, 회사는 정보 파기 등 필요 조치를 시행합니다.

■ 예외 보유 기간
1) 부정 이용 조사: 최대 3개월
   - 이름, 이메일, 주소, 전화, 성별, 비자 종류
   - 부정/사기 이용 기록
2) 게시 콘텐츠: 삭제 게시물 3개월 (광고, 스팸, 음란, 욕설, 정보 침해, 저작권 침해, 불법 콘텐츠)
3) 법령에 따른 보존
   - 접속 정보 (계정 생성 IP, 최종 로그인): 3개월 (통신비밀보호법)
   - 불법 촬영 신고: 3년 (전기통신사업법)`}
        </Section>

        <Section title="7. 개인정보의 파기절차 및 방법">
          {`■ 절차
이용자가 입력한 정보 (비밀번호, 닉네임)는 목적 달성 후 별도 데이터베이스로 이관되어 내부 정책 및 관련 법령에 따라 보관 후 파기됩니다.

이관된 정보는 법적으로 요구되는 경우 외에는 다른 목적으로 사용되지 않습니다.

■ 파기 방법
전자 파일은 복구 불가능한 기술적 방법으로 삭제합니다.`}
        </Section>

        <Section title="8. 개인정보 보관 및 보호를 위한 기술적, 관리적 대책">
          {`■ 비밀번호 보호
사용자 정보는 본인만 알고 있는 비밀번호로 보호됩니다.

■ 직원 관리
정보 처리 인원을 제한하고 정기적인 직원 교육과 내부 감사를 통해 정책 준수를 강화합니다.

■ 보안 조치
1) 백신 프로그램 정기 업데이트
2) 데이터베이스 보안 기능을 통한 접근 제한
3) 방화벽 및 침입 탐지 시스템
4) 개인정보 보호책임자 및 필수 인원으로 접근 제한
5) 일반 데이터와 분리된 별도 계정에 사용자 정보 유지
6) 가능한 모든 기술적 보안 장치 구현`}
        </Section>

        <Section title="9. 계정 이용자 및 법정대리인의 권리와 행사방법">
          {`이용자 및 법정대리인은 계정 정보를 조회·수정 또는 탈퇴할 수 있습니다.

■ 행사 방법
- 로그인 후 홈페이지의 '계정 정보' 클릭
- 개인정보 보호책임자에게 이메일 또는 팩스로 즉시 처리

삭제된 정보는 7항의 파기 절차에 따라 처리됩니다.`}
        </Section>

        <Section title="10. 개인정보 자동 수집 장치의 설치와 운영 및 거부에 관한 사항">
          {`■ 쿠키 사용
회사는 맞춤형 서비스 제공을 위해 쿠키를 사용합니다. 쿠키는 사용자 기기에 저장되는 작은 텍스트 파일입니다.

■ 목적
접근 패턴을 통해 사용자 선호와 관심사를 파악하여 최적화된 개인화 정보를 제공합니다.

■ 쿠키 설정
사용자는 웹 브라우저 옵션에서 모든 쿠키 허용·각 저장 시 확인·모두 거부 가능합니다. 쿠키 거부 시 일부 서비스 기능이 제한될 수 있습니다.

■ Google Analytics
회사는 사용자 식별 없이 전체 로그 분석을 위해 Google Analytics 를 사용합니다. 사용자는 '쿠키 차단' 또는 'Google Analytics 차단 브라우저 확장' 으로 수집을 거부할 수 있습니다.

■ 앱 사용 분석
앱 스토어 또는 광고주가 수집: Google 광고 ID, Android ID, 기기 정보 (모델, OS 버전, 고유 식별자).

■ 거부 방법
- Android: 설정 > Google > 광고 / 설정 > 계정 및 동기화 > 개인정보 > 광고 설정
- iOS: 설정 > 개인정보 보호 > 광고

■ YouTube API 서비스
회사는 YouTube API 를 사용하며, 다음 약관을 준수합니다:
- YouTube 이용약관 (https://www.youtube.com/t/terms)
- Google 개인정보 처리방침 (https://policies.google.com/privacy)
- YouTube API 이용약관 (https://developers.google.com/youtube/terms/api-services-terms-of-service-apac?hl=ko)

수집 항목: YouTube 채널 이름, 구독자, 영상 수, 조회수, 영상 목록.
사용자는 (https://myaccount.google.com/permissions) 에서 접근을 취소할 수 있습니다.`}
        </Section>

        <Section title="11. 개인정보보호 책임자에 관한 사항">
          {`■ 개인정보 보호책임자
- 이름: 홍강식
- 부서: 경영진
- 직책: 대표이사 / CEO

'개인정보 보호 부서' 가 사용자 정보 공개 요청을 전담합니다. 사용자는 정보 관련 우려가 있는 경우 이메일 또는 팩스로 책임자에게 연락할 수 있습니다.`}
        </Section>

        <Section title="12. 권익침해 구제방법">
          {`정보 침해를 경험한 사용자는 다음을 통해 해결을 모색할 수 있습니다.

- 개인정보 분쟁조정위원회 (https://www.kopico.go.kr / 1833-6972)
- 개인정보 침해신고센터 (https://privacy.kisa.or.kr / 118)
- 대검찰청 (https://www.spo.go.kr / 1301)
- 경찰청 (https://ecrm.police.go.kr / 182)`}
        </Section>

        <Section title="13. 개정 전 고지의무">
          {`■ 통지 시점
- 일반 개정: 회사 서비스 공지를 통해 최소 7일 전 안내
- 사용자 권리 중요 변경 (수집 항목 추가, 목적 변경): 최소 14일 전 안내
- 필요 시 재동의 요청 가능`}
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "2rem" }}>
      <h3
        style={{
          fontFamily: "var(--font-noto-serif-kr), serif",
          fontSize: "1rem",
          fontWeight: 800,
          color: "var(--ink)",
          marginBottom: "0.6rem",
        }}
      >
        {title}
      </h3>
      <div style={{ whiteSpace: "pre-line" }}>{children}</div>
    </div>
  );
}
