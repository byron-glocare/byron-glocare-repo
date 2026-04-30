/**
 * 이력서 PDF 생성 — @react-pdf/renderer 기반.
 * 원본 PDF 양식 (이력서_레티비.pdf) 의 레이아웃 1:1 모방.
 */
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  Image,
  Font,
  pdf,
} from "@react-pdf/renderer";

// 한글 + 베트남어 모두 지원하는 폰트 — Noto Sans KR (Latin + Korean)
// Vercel 빌드 시 외부 fetch 가능하므로 Google Fonts CDN 사용
Font.register({
  family: "NotoSansKR",
  fonts: [
    {
      src: "https://fonts.gstatic.com/ea/notosanskr/v2/NotoSansKR-Regular.otf",
      fontWeight: 400,
    },
    {
      src: "https://fonts.gstatic.com/ea/notosanskr/v2/NotoSansKR-Bold.otf",
      fontWeight: 700,
    },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontFamily: "NotoSansKR",
    fontSize: 10,
    color: "#1c1c1e",
    lineHeight: 1.6,
  },
  topBar: {
    fontSize: 8,
    color: "#aeaeb2",
    marginBottom: 12,
    borderBottom: "1px solid #f0eded",
    paddingBottom: 8,
  },
  topBarLeft: { fontSize: 8, color: "#6e6e73" },
  brand: {
    fontSize: 9,
    fontWeight: 700,
    color: "#F25C5C",
  },
  header: {
    flexDirection: "row",
    marginBottom: 24,
    alignItems: "flex-start",
  },
  headerLeft: { flex: 1 },
  name: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 6,
  },
  contact: {
    fontSize: 9,
    color: "#3a3a3c",
    marginBottom: 4,
  },
  motto: {
    fontSize: 10,
    fontStyle: "italic",
    color: "#6e6e73",
    marginTop: 6,
  },
  photo: {
    width: 90,
    height: 110,
    border: "1px solid #f0eded",
    marginLeft: 16,
    objectFit: "cover",
  },
  section: { marginBottom: 16 },
  sectionTitle: {
    backgroundColor: "#FFF7F5",
    color: "#1c1c1e",
    fontSize: 11,
    fontWeight: 700,
    padding: "6px 10px",
    borderLeft: "3px solid #F25C5C",
    marginBottom: 8,
  },
  table: {
    border: "1px solid #f0eded",
    borderRadius: 4,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#FFF0F0",
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 8,
    paddingRight: 8,
    fontSize: 9,
    fontWeight: 700,
    color: "#3a3a3c",
    borderBottom: "1px solid #f0eded",
  },
  tableRow: {
    flexDirection: "row",
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 8,
    paddingRight: 8,
    fontSize: 9,
    color: "#1c1c1e",
    borderBottom: "1px solid #f0eded",
  },
  tableRowLast: { borderBottom: 0 },
  cell: { paddingRight: 6 },
  cellName: { flex: 2 },
  cellMeta: { flex: 1 },
  selfIntro: {
    fontSize: 10,
    color: "#1c1c1e",
    lineHeight: 1.7,
    whiteSpace: "pre-line",
  },
});

type Props = {
  nameKo: string;
  nameVi: string;
  birthDate: string;
  phone: string;
  email: string;
  addressKo: string;
  motto: string;
  photoUrl?: string | null;
  education: Array<{
    school: string;
    major?: string;
    period?: string;
    status?: string;
  }>;
  experience: Array<{
    place: string;
    period?: string;
    role?: string;
    detail?: string;
    status?: string;
  }>;
  certificates: Array<{
    name: string;
    issuer?: string;
    date?: string;
  }>;
  skills: Array<{ name: string; detail?: string; level?: string }>;
  activities: Array<{
    name: string;
    period?: string;
    org?: string;
    detail?: string;
  }>;
  selfIntro: string;
};

function ResumeDoc(props: Props) {
  return (
    <Document>
      {/* PAGE 1 — basics + tables */}
      <Page size="A4" style={styles.page}>
        <View style={styles.topBar}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <Text style={styles.topBarLeft}>요 양 보 호 사  이 력 서</Text>
            <Text style={styles.brand}>GLOCARE</Text>
          </View>
        </View>

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.name}>
              {props.nameVi} / {props.nameKo}
            </Text>
            <Text style={styles.contact}>
              {props.birthDate} | {props.phone} | {props.email}
            </Text>
            <Text style={styles.contact}>{props.addressKo}</Text>
            {props.motto ? (
              <Text style={styles.motto}>{props.motto}</Text>
            ) : null}
          </View>
          {props.photoUrl ? (
            /* eslint-disable-next-line jsx-a11y/alt-text */
            <Image src={props.photoUrl} style={styles.photo} />
          ) : null}
        </View>

        {/* 학력 */}
        {props.education.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>학력</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.cell, styles.cellName]}>학교명</Text>
                <Text style={[styles.cell, styles.cellMeta]}>전공</Text>
                <Text style={[styles.cell, styles.cellMeta]}>기간</Text>
                <Text style={[styles.cell, styles.cellMeta]}>졸업여부</Text>
              </View>
              {props.education.map((e, i) => (
                <View
                  key={i}
                  style={[
                    styles.tableRow,
                    i === props.education.length - 1
                      ? styles.tableRowLast
                      : {},
                  ]}
                >
                  <Text style={[styles.cell, styles.cellName]}>
                    {e.school}
                  </Text>
                  <Text style={[styles.cell, styles.cellMeta]}>
                    {e.major ?? ""}
                  </Text>
                  <Text style={[styles.cell, styles.cellMeta]}>
                    {e.period ?? ""}
                  </Text>
                  <Text style={[styles.cell, styles.cellMeta]}>
                    {e.status ?? ""}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 경력 */}
        {props.experience.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>경력</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.cell, { flex: 1.3 }]}>근무처</Text>
                <Text style={[styles.cell, { flex: 1 }]}>기간</Text>
                <Text style={[styles.cell, { flex: 1 }]}>직책</Text>
                <Text style={[styles.cell, { flex: 2 }]}>주요 업무</Text>
                <Text style={[styles.cell, { flex: 0.6 }]}>상태</Text>
              </View>
              {props.experience.map((e, i) => (
                <View
                  key={i}
                  style={[
                    styles.tableRow,
                    i === props.experience.length - 1
                      ? styles.tableRowLast
                      : {},
                  ]}
                >
                  <Text style={[styles.cell, { flex: 1.3 }]}>{e.place}</Text>
                  <Text style={[styles.cell, { flex: 1 }]}>
                    {e.period ?? ""}
                  </Text>
                  <Text style={[styles.cell, { flex: 1 }]}>
                    {e.role ?? ""}
                  </Text>
                  <Text style={[styles.cell, { flex: 2 }]}>
                    {e.detail ?? ""}
                  </Text>
                  <Text style={[styles.cell, { flex: 0.6 }]}>
                    {e.status ?? ""}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 자격증 */}
        {props.certificates.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>자격증 및 수상</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.cell, styles.cellName]}>명칭</Text>
                <Text style={[styles.cell, styles.cellMeta]}>발급기관</Text>
                <Text style={[styles.cell, styles.cellMeta]}>취득일</Text>
              </View>
              {props.certificates.map((c, i) => (
                <View
                  key={i}
                  style={[
                    styles.tableRow,
                    i === props.certificates.length - 1
                      ? styles.tableRowLast
                      : {},
                  ]}
                >
                  <Text style={[styles.cell, styles.cellName]}>{c.name}</Text>
                  <Text style={[styles.cell, styles.cellMeta]}>
                    {c.issuer ?? ""}
                  </Text>
                  <Text style={[styles.cell, styles.cellMeta]}>
                    {c.date ?? ""}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 기술 / 어학 */}
        {props.skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>기술 및 어학</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.cell, styles.cellName]}>명칭</Text>
                <Text style={[styles.cell, styles.cellMeta]}>상세</Text>
                <Text style={[styles.cell, styles.cellMeta]}>수준</Text>
              </View>
              {props.skills.map((s, i) => (
                <View
                  key={i}
                  style={[
                    styles.tableRow,
                    i === props.skills.length - 1 ? styles.tableRowLast : {},
                  ]}
                >
                  <Text style={[styles.cell, styles.cellName]}>{s.name}</Text>
                  <Text style={[styles.cell, styles.cellMeta]}>
                    {s.detail ?? ""}
                  </Text>
                  <Text style={[styles.cell, styles.cellMeta]}>
                    {s.level ?? ""}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 기타 활동 */}
        {props.activities.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>기타 활동</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.cell, { flex: 2 }]}>활동명</Text>
                <Text style={[styles.cell, { flex: 1 }]}>기간</Text>
                <Text style={[styles.cell, { flex: 1.5 }]}>기관</Text>
                <Text style={[styles.cell, { flex: 2 }]}>상세</Text>
              </View>
              {props.activities.map((a, i) => (
                <View
                  key={i}
                  style={[
                    styles.tableRow,
                    i === props.activities.length - 1
                      ? styles.tableRowLast
                      : {},
                  ]}
                >
                  <Text style={[styles.cell, { flex: 2 }]}>{a.name}</Text>
                  <Text style={[styles.cell, { flex: 1 }]}>
                    {a.period ?? ""}
                  </Text>
                  <Text style={[styles.cell, { flex: 1.5 }]}>
                    {a.org ?? ""}
                  </Text>
                  <Text style={[styles.cell, { flex: 2 }]}>
                    {a.detail ?? ""}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </Page>

      {/* PAGE 2 — 자기소개 및 포부 */}
      <Page size="A4" style={styles.page}>
        <View style={styles.topBar}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <Text style={styles.topBarLeft}>요 양 보 호 사  이 력 서</Text>
            <Text style={styles.brand}>GLOCARE</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>자기소개 및 포부</Text>
          <Text style={styles.selfIntro}>{props.selfIntro}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generateResumePdf(data: Props): Promise<Buffer> {
  const stream = await pdf(<ResumeDoc {...data} />).toBuffer();
  // Stream → Buffer
  const chunks: Buffer[] = [];
  for await (const chunk of stream as unknown as AsyncIterable<Buffer | string>) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}
