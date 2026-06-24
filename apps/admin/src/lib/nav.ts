import {
  BookOpen,
  Building2,
  ClipboardList,
  Database,
  DollarSign,
  FileText,
  Film,
  FileType,
  GraduationCap,
  Hospital,
  Inbox,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Plane,
  Radio,
  Receipt,
  School,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** 준비 중 — 메뉴는 보이지만 클릭/이동 비활성 */
  disabled?: boolean;
};

export type NavGroup = {
  /** 빈 문자열이면 그룹 헤더 없음 (최상위 항목) */
  label: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "",
    items: [{ href: "/", label: "대시보드", icon: LayoutDashboard }],
  },
  {
    label: "요양보호",
    items: [
      { href: "/customers", label: "교육생", icon: Users },
      { href: "/training-centers", label: "교육원", icon: GraduationCap },
      { href: "/care-homes", label: "요양원", icon: Hospital },
      { href: "/sms", label: "알림 발송", icon: MessageSquare },
      { href: "/settlements", label: "정산", icon: Receipt },
    ],
  },
  {
    label: "유학",
    items: [
      { href: "/managed-students", label: "유학생", icon: Plane },
      { href: "/students", label: "상담", icon: Inbox },
      { href: "/study-centers", label: "유학센터", icon: Building2 },
      { href: "/study-cases", label: "사례", icon: Film },
      { href: "/study-channels", label: "SNS", icon: Radio },
      { href: "/study-invoices", label: "정산", icon: FileText },
      { href: "/pricing-plans", label: "유학센터 상품", icon: DollarSign },
      // "유학센터 회사"(center-orgs) 메뉴는 유학센터(study_centers)로 통합되어 제거됨.
    ],
  },
  {
    label: "대학",
    items: [
      { href: "/universities", label: "대학교", icon: School },
      { href: "/departments", label: "학과", icon: BookOpen },
      { href: "/offerings", label: "모집", icon: Megaphone },
      { href: "/admissions", label: "입학서류", icon: ClipboardList },
      { href: "/student-data-types", label: "데이터", icon: Database },
      { href: "/docx-test", label: "양식 테스트", icon: FileType },
    ],
  },
  {
    label: "시스템",
    items: [
      { href: "/accounts", label: "계정 관리", icon: ShieldCheck },
      { href: "/settings", label: "설정", icon: Settings },
    ],
  },
];
