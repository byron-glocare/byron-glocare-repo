import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Hospital,
  Receipt,
  MessageSquare,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/customers", label: "고객관리", icon: Users },
  { href: "/training-centers", label: "교육원", icon: GraduationCap },
  { href: "/care-homes", label: "요양원", icon: Hospital },
  { href: "/settlements", label: "정산", icon: Receipt },
  { href: "/sms", label: "알림발송", icon: MessageSquare },
  { href: "/settings", label: "설정", icon: Settings },
];
