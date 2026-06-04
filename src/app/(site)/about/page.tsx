import { PartnerForm } from "@/components/sections/partner-form";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const aboutStrings = {
  ko: {
    heroTag: "GLOCARE",
    heroTitleHtml: "유학, <em>그 이상의 가치</em>",
    heroDesc: "입학부터 정착까지 — 글로케어가 함께합니다.",
    stats: [
      { n: "8", suffix: "%", l: "현재 졸업 후 취업 비자 취득률" },
      { n: "50", suffix: "K+", l: "한국 내 베트남 유학생 수" },
      { n: "23", suffix: "+", l: "글로케어 제휴 대학" },
    ],
    ceoTag: "CEO 메시지",
    ceoTitleHtml: "성공적인 한국 정착,<br/><em>글로케어가 함께합니다</em>",
    ceoQuote:
      "\"우리는 유학 상담만 하지 않습니다 — 당신의 정착 경로를 설계합니다.\"",
    ceoBlocks: [
      {
        num: 1,
        title: "현실을 직시합니다",
        items: [
          "베트남 유학생 5만 명 시대, 하지만 졸업 후 취업 비자 취득률은 <strong>단 8%</strong>에 불과합니다.",
          "한국에서의 높은 소득과 안정적인 생활을 꿈꾸지만, 지금까지 정착의 길은 너무나 좁았습니다.",
        ],
      },
      {
        num: 2,
        title: "변화하는 정책에 주목합니다",
        items: [
          "한국은 이제 '단기 노동력'이 아닌 <strong>장기 정주형 인재</strong>를 원합니다.",
          "2026년부터 시작된 <strong>광역형(지역 특화형) 비자</strong>가 새로운 기회의 문을 열고 있습니다.",
        ],
      },
      {
        num: 3,
        title: "지역별 맞춤 전략을 제시합니다",
        items: [
          "<strong>대구·경북</strong>: 자동차 및 미래 모빌리티 산업 (E-7 비자 유리)",
          "<strong>전남 지역</strong>: 조선 및 해양 산업 (지역 특화 비자 유리)",
          "<strong>글로케어</strong>: 지역별 산업 흐름을 분석하여 가장 확실한 취업처를 매칭합니다.",
        ],
      },
      {
        num: 4,
        title: "실질적인 해법을 제공합니다",
        items: [
          "<strong>요양보호사 전문 트랙</strong>: D-10(구직) 비자 학생들을 위한 자격증 취득 및 취업 지원",
          "단순 유학 상담을 넘어, 입학부터 취업, 정착까지 <strong>책임지는 파트너</strong>가 되겠습니다.",
        ],
      },
    ],
    ceoClosing:
      "\"이제 유학은 학교 선택이 아닌 <strong>정착 전략</strong>입니다. 글로케어와 함께 당신의 미래를 설계하십시오.\"",
    ceoSignTitle: "글로케어 대표",
    ceoSignName: "홍강식 · HONG KANG SIK · CEO",
    partnerTag: "비즈니스 제휴",
    partnerTitleHtml: "함께 성장할<br/><em>파트너를 찾습니다</em>",
    partnerSub:
      "유학센터, 대학교, 채용기업 등 — 함께할 파트너를 언제든 환영합니다.",
    channelsTag: "채널",
    channelsTitleHtml: "GLOCARE <em>채널</em>",
    channelsSub: "글로케어의 채널을 구독하세요.",
    backHome: "홈으로",
    partner: {
      types: [
        {
          ico: "🇻🇳",
          name: "유학센터",
          desc: "베트남 현지 유학센터",
          value: "유학센터 / Trung tâm du học",
        },
        {
          ico: "🏛️",
          name: "대학교",
          desc: "외국인 유학생 유치 협력",
          value: "대학교 / Trường đại học",
        },
        {
          ico: "🏢",
          name: "채용기업",
          desc: "베트남 인재 채용 연계",
          value: "채용기업 / Doanh nghiệp tuyển dụng",
        },
        {
          ico: "🤝",
          name: "기타",
          desc: "기타 협력 문의",
          value: "기타 / Khác",
        },
      ],
      fName: "담당자 이름",
      fNamePh: "홍길동",
      fCompany: "회사/기관명",
      fCompanyPh: "회사명",
      fPhone: "연락처 / 카카오톡",
      fPhonePh: "+82",
      fEmail: "이메일",
      fEmailPh: "contact@company.com",
      fType: "제휴 유형",
      fRegion: "국가/지역",
      fRegionPh: "한국 / 베트남",
      fMessage: "제휴 제안 내용",
      fMessagePh: "제휴 내용을 자유롭게 적어주세요...",
      submit: "제휴 문의 보내기 →",
      successTitle: "제출이 완료됐습니다!",
      successDesc: "담당자가 빠르게 연락드리겠습니다.",
      errEmpty: "이름, 회사명, 이메일을 입력해주세요.",
    },
  },
  vi: {
    heroTag: "GLOCARE",
    heroTitleHtml: "Du học, <em>hơn cả học tập</em>",
    heroDesc:
      "Từ nhập học đến định cư — GLOCARE đồng hành cùng bạn trong mọi bước đường.",
    stats: [
      { n: "8", suffix: "%", l: "Tỷ lệ có việc làm sau tốt nghiệp (hiện tại)" },
      { n: "50", suffix: "K+", l: "Sinh viên Việt Nam tại Hàn Quốc" },
      { n: "23", suffix: "+", l: "Trường đại học liên kết" },
    ],
    ceoTag: "TỪ CEO",
    ceoTitleHtml:
      "Thành công định cư tại Hàn Quốc,<br/><em>GLOCARE đồng hành</em>",
    ceoQuote:
      "\"Chúng tôi không chỉ tư vấn du học — chúng tôi thiết kế con đường định cư của bạn.\"",
    ceoBlocks: [
      {
        num: 1,
        title: "Nhìn thẳng vào thực tế",
        items: [
          "Kỷ nguyên 50.000 sinh viên Việt Nam tại Hàn Quốc — nhưng tỷ lệ có visa làm việc sau tốt nghiệp chỉ <strong>8%</strong>.",
          "Thu nhập cao và cuộc sống ổn định là ước mơ — nhưng con đường định cư luôn quá hẹp.",
        ],
      },
      {
        num: 2,
        title: "Chú ý đến chính sách đang thay đổi",
        items: [
          "Hàn Quốc không còn muốn 'lao động ngắn hạn' — họ muốn <strong>nhân tài định cư dài hạn</strong>.",
          "<strong>Visa đặc thù theo vùng (2026)</strong> — cánh cửa cơ hội mới đang mở ra.",
        ],
      },
      {
        num: 3,
        title: "Chiến lược tùy chỉnh theo từng vùng",
        items: [
          "<strong>Daegu · Gyeongbuk</strong>: Công nghiệp ô tô và di chuyển tương lai (Visa E-7 thuận lợi)",
          "<strong>Jeonnam</strong>: Công nghiệp đóng tàu và hàng hải (Visa đặc thù theo vùng)",
          "<strong>GLOCARE</strong>: Phân tích dòng chảy công nghiệp từng vùng → kết nối việc làm chính xác nhất.",
        ],
      },
      {
        num: 4,
        title: "Giải pháp thực tế",
        items: [
          "<strong>Track chăm sóc người cao tuổi</strong>: Hỗ trợ lấy chứng chỉ và tìm việc cho sinh viên visa D-10",
          "Không chỉ là tư vấn du học đơn thuần — <strong>người bạn đồng hành từ nhập học đến định cư</strong>.",
        ],
      },
    ],
    ceoClosing:
      "\"Du học không chỉ là chọn trường — đó là <strong>chiến lược định cư</strong>. Hãy để GLOCARE thiết kế tương lai của bạn.\"",
    ceoSignTitle: "Đại diện GLOCARE",
    ceoSignName: "홍강식 · HONG KANG SIK · CEO",
    partnerTag: "HỢP TÁC KINH DOANH",
    partnerTitleHtml:
      "Cùng nhau phát triển —<br/><em>tìm kiếm đối tác</em>",
    partnerSub:
      "Trung tâm du học, trường đại học, doanh nghiệp tuyển dụng — hãy liên hệ với chúng tôi.",
    channelsTag: "KÊNH",
    channelsTitleHtml: "Kênh <em>GLOCARE</em>",
    channelsSub: "Theo dõi các kênh của GLOCARE.",
    backHome: "Trang chủ",
    partner: {
      types: [
        {
          ico: "🇻🇳",
          name: "Trung tâm du học",
          desc: "Đại lý tuyển sinh tại Việt Nam",
          value: "유학센터 / Trung tâm du học",
        },
        {
          ico: "🏛️",
          name: "Trường đại học",
          desc: "Hợp tác tuyển sinh nước ngoài",
          value: "대학교 / Trường đại học",
        },
        {
          ico: "🏢",
          name: "Doanh nghiệp tuyển dụng",
          desc: "Kết nối nhân lực Việt Nam",
          value: "채용기업 / Doanh nghiệp tuyển dụng",
        },
        {
          ico: "🤝",
          name: "Khác",
          desc: "Các hình thức hợp tác khác",
          value: "기타 / Khác",
        },
      ],
      fName: "Họ và tên",
      fNamePh: "Nguyễn Văn A",
      fCompany: "Tên công ty / tổ chức",
      fCompanyPh: "Company",
      fPhone: "Số điện thoại / Zalo",
      fPhonePh: "+84",
      fEmail: "Email",
      fEmailPh: "contact@company.com",
      fType: "Loại hợp tác",
      fRegion: "Quốc gia / Khu vực",
      fRegionPh: "Việt Nam / Hàn Quốc",
      fMessage: "Nội dung đề xuất hợp tác",
      fMessagePh: "Nội dung hợp tác...",
      submit: "Gửi đề xuất hợp tác →",
      successTitle: "Đã gửi thành công!",
      successDesc: "Chúng tôi sẽ phản hồi sớm nhất.",
      errEmpty: "Vui lòng nhập họ tên, công ty và email.",
    },
  },
};

const channelBgClass: Record<string, string> = {
  tiktok: "ch-tiktok",
  facebook: "ch-facebook",
  instagram: "ch-instagram",
  website: "ch-website",
};

export default async function AboutPage() {
  const supabase = await createClient();
  const locale = await getLocale();
  const s = aboutStrings[locale];

  const { data: channels } = await supabase
    .from("study_channels")
    .select("*")
    .order("sort_order")
    .order("id");

  return (
    <>
      <section className="about-hero">
        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="hero-tag">{s.heroTag}</div>
          <h1 dangerouslySetInnerHTML={{ __html: s.heroTitleHtml }} />
          <p>{s.heroDesc}</p>
        </div>
      </section>

      <div className="stats-strip">
        <div className="stats-grid">
          {s.stats.map((stat, i) => (
            <div key={i} className="stat-item">
              <div className="stat-n">
                {stat.n}
                <span>{stat.suffix}</span>
              </div>
              <div className="stat-l">{stat.l}</div>
            </div>
          ))}
        </div>
      </div>

      <section id="ceo" className="about-section">
        <div className="sec-inner">
          <div className="sec-tag">{s.ceoTag}</div>
          <h2
            className="sec-title"
            dangerouslySetInnerHTML={{ __html: s.ceoTitleHtml }}
          />
          <div className="ceo-quote">{s.ceoQuote}</div>

          {s.ceoBlocks.map((block) => (
            <div key={block.num} className="ceo-block">
              <div className="ceo-block-title">
                <div className="ceo-num">{block.num}</div>
                <span>{block.title}</span>
              </div>
              <div className="ceo-body">
                <ul>
                  {block.items.map((item, i) => (
                    <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
                  ))}
                </ul>
              </div>
            </div>
          ))}

          <div
            className="ceo-closing"
            dangerouslySetInnerHTML={{ __html: s.ceoClosing }}
          />

          <div className="ceo-sign">
            <div className="ceo-sign-line" />
            <div className="ceo-sign-name">
              <div>{s.ceoSignTitle}</div>
              <strong>{s.ceoSignName}</strong>
            </div>
          </div>
        </div>
      </section>

      <section id="partner" className="about-section">
        <div className="sec-inner">
          <div className="sec-tag">{s.partnerTag}</div>
          <h2
            className="sec-title"
            dangerouslySetInnerHTML={{ __html: s.partnerTitleHtml }}
          />
          <p className="sec-sub">{s.partnerSub}</p>

          <PartnerForm strings={s.partner} />
        </div>
      </section>

      <section id="channels" className="about-section">
        <div className="sec-inner">
          <div className="sec-tag">{s.channelsTag}</div>
          <h2
            className="sec-title"
            dangerouslySetInnerHTML={{ __html: s.channelsTitleHtml }}
          />
          <p className="sec-sub">{s.channelsSub}</p>

          <div className="channel-grid">
            {(channels ?? []).map((ch) => {
              const type = (ch.type ?? "website").toLowerCase();
              const bgClass = channelBgClass[type] ?? "ch-website";
              const name =
                locale === "vi"
                  ? (ch.name_vi ?? ch.name_ko ?? "")
                  : (ch.name_ko ?? ch.name_vi ?? "");
              const desc =
                locale === "vi"
                  ? (ch.desc_vi ?? ch.desc_ko ?? "")
                  : (ch.desc_ko ?? ch.desc_vi ?? "");
              return (
                <a
                  key={ch.id}
                  href={ch.url ?? "#"}
                  className="channel-card"
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className={`ch-ico ${bgClass}`}>{ch.icon ?? "🔗"}</div>
                  <div className="ch-name">{name}</div>
                  <div className="ch-desc">{desc}</div>
                  {ch.handle && <div className="ch-handle">{ch.handle}</div>}
                </a>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
