import {
  Building2,
  Film,
  GraduationCap,
  Hospital,
  LayoutDashboard,
  MessageSquare,
  Plane,
  Receipt,
  School,
  Settings,
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
    label: "요양보호사",
    items: [
      { href: "/customers", label: "교육생", icon: Users },
      { href: "/training-centers", label: "교육원", icon: GraduationCap },
      { href: "/care-homes", label: "요양원", icon: Hospital },
      { href: "/sms", label: "알림 발송", icon: MessageSquare },
      { href: "/settlements", label: "정산", icon: Receipt },
    ],
  },
  {
    label: "유학생",
    items: [
      { href: "/students", label: "유학생", icon: Plane },
      { href: "/universities", label: "대학교", icon: School },
      { href: "/study-centers", label: "유학센터", icon: Building2 },
      { href: "/study-cases", label: "사례", icon: Film },
    ],
  },
  {
    label: "",
    items: [{ href: "/settings", label: "설정", icon: Settings }],
  },
];
