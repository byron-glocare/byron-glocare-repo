"use client";

/**
 * 어드민 사이드바.
 *   그룹은 접었다 펼 수 있고, 그룹 머리를 잡아 끌어 순서를 바꿀 수 있다.
 *   접힘·순서는 이 브라우저에만 저장된다(localStorage). 기본 순서는 nav.ts.
 *   현재 페이지가 든 그룹은 접혀 있어도 펼쳐 보인다 — 지금 어디 있는지는 늘 보여야 한다.
 */

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, GripVertical } from "lucide-react";

import { cn } from "@/lib/utils";
import { NAV_GROUPS, type NavGroup } from "@/lib/nav";

const STORAGE_KEY = "admin.sidebar.v1";

type Saved = { order: string[]; collapsed: string[] };

function loadSaved(): Saved | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Saved>;
    return {
      order: Array.isArray(v.order) ? v.order.filter((s) => typeof s === "string") : [],
      collapsed: Array.isArray(v.collapsed) ? v.collapsed.filter((s) => typeof s === "string") : [],
    };
  } catch {
    return null;
  }
}

function persist(s: Saved) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // 저장 못 해도 화면은 동작한다
  }
}

/** 저장된 순서를 적용하되, 새로 생긴 그룹은 기본 위치에 끼워 넣는다. 라벨 없는 그룹(최상위)은 늘 맨 위. */
function applyOrder(groups: NavGroup[], order: string[]): NavGroup[] {
  const top = groups.filter((g) => !g.label);
  const labeled = groups.filter((g) => !!g.label);
  const byLabel = new Map(labeled.map((g) => [g.label, g]));
  const ordered: NavGroup[] = [];
  for (const l of order) {
    const g = byLabel.get(l);
    if (g) {
      ordered.push(g);
      byLabel.delete(l);
    }
  }
  for (const g of labeled) if (byLabel.has(g.label)) ordered.push(g);
  return [...top, ...ordered];
}

export function AppSidebar() {
  const pathname = usePathname();
  const [order, setOrder] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  useEffect(() => {
    const s = loadSaved();
    if (!s) return;
    setOrder(s.order);
    setCollapsed(new Set(s.collapsed));
  }, []);

  const groups = applyOrder(NAV_GROUPS, order);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function save(nextOrder: string[], nextCollapsed: Set<string>) {
    persist({ order: nextOrder, collapsed: Array.from(nextCollapsed) });
  }

  function toggle(label: string) {
    const next = new Set(collapsed);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    setCollapsed(next);
    save(order, next);
  }

  function move(from: string, to: string) {
    if (from === to) return;
    const labels = groups.filter((g) => !!g.label).map((g) => g.label);
    const a = labels.indexOf(from);
    const b = labels.indexOf(to);
    if (a < 0 || b < 0) return;
    labels.splice(a, 1);
    labels.splice(b, 0, from);
    setOrder(labels);
    save(labels, collapsed);
  }

  return (
    <aside className="hidden md:flex md:w-60 shrink-0 flex-col border-r border-border bg-sidebar">
      <Link
        href="/"
        className="flex h-20 items-center gap-2 px-5 border-b border-border"
      >
        <Image
          src="/glocare_logo.png"
          alt="Glocare"
          width={140}
          height={70}
          priority
          className="h-auto w-auto max-h-14"
        />
      </Link>
      <nav className="flex-1 overflow-y-auto p-3 space-y-3">
        {groups.map((group) => {
          const hasActive = group.items.some((i) => !i.disabled && isActive(i.href));
          const isCollapsed = !!group.label && collapsed.has(group.label) && !hasActive;
          const draggable = !!group.label;
          return (
            <div
              key={group.label || "__top"}
              className={cn(
                "space-y-1 rounded-md transition-colors",
                over === group.label && dragging && dragging !== group.label
                  ? "ring-2 ring-primary/40"
                  : ""
              )}
              onDragOver={(e) => {
                if (!draggable || !dragging) return;
                e.preventDefault();
                if (over !== group.label) setOver(group.label);
              }}
              onDragLeave={() => {
                if (over === group.label) setOver(null);
              }}
              onDrop={(e) => {
                if (!draggable || !dragging) return;
                e.preventDefault();
                move(dragging, group.label);
                setDragging(null);
                setOver(null);
              }}
            >
              {group.label && (
                <div
                  className={cn(
                    "group/hd flex items-center gap-1 rounded-md pr-1",
                    dragging === group.label ? "opacity-50" : ""
                  )}
                  draggable
                  onDragStart={(e) => {
                    setDragging(group.label);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", group.label);
                  }}
                  onDragEnd={() => {
                    setDragging(null);
                    setOver(null);
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggle(group.label)}
                    aria-expanded={!isCollapsed}
                    className="flex flex-1 items-center gap-1 px-3 pt-2 pb-1 text-left text-[10px] uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground"
                  >
                    <ChevronDown
                      className={cn(
                        "size-3 shrink-0 transition-transform",
                        isCollapsed ? "-rotate-90" : ""
                      )}
                    />
                    <span>{group.label}</span>
                    {isCollapsed ? (
                      <span className="ml-1 font-normal normal-case tracking-normal text-muted-foreground/70">
                        {group.items.length}
                      </span>
                    ) : null}
                  </button>
                  <span
                    className="cursor-grab text-muted-foreground/40 opacity-0 transition-opacity group-hover/hd:opacity-100 active:cursor-grabbing"
                    title="잡아 끌어 순서 바꾸기"
                    aria-hidden
                  >
                    <GripVertical className="size-3.5" />
                  </span>
                </div>
              )}
              {!isCollapsed &&
                group.items.map((item) => {
                  const Icon = item.icon;
                  const active = !item.disabled && isActive(item.href);

                  if (item.disabled) {
                    return (
                      <div
                        key={item.href}
                        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground/60 cursor-not-allowed select-none"
                        title="준비 중"
                      >
                        <Icon className="size-4 shrink-0" />
                        <span>{item.label}</span>
                        <span className="ml-auto text-[10px] uppercase tracking-wider">
                          준비 중
                        </span>
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          active ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
            </div>
          );
        })}
      </nav>
      <div className="px-5 py-3 text-[11px] text-muted-foreground border-t border-border">
        v0.1.0 · 내부 관리용
      </div>
    </aside>
  );
}
