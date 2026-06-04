"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_GROUPS } from "@/lib/nav";

export function AppSidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
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
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className="space-y-1">
            {group.label && (
              <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                {group.label}
              </div>
            )}
            {group.items.map((item) => {
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
        ))}
      </nav>
      <div className="px-5 py-3 text-[11px] text-muted-foreground border-t border-border">
        v0.1.0 · 내부 관리용
      </div>
    </aside>
  );
}
