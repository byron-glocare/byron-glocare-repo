"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Calendar,
  ChevronRight,
  GraduationCap,
  Hospital,
  MessageSquare,
  Phone,
  Receipt,
  Search,
  type LucideIcon,
} from "lucide-react";

import type { TaskBucket } from "@/lib/dashboard";
import { Card } from "@/components/ui/card";

const ICONS: Record<TaskBucket["key"], LucideIcon> = {
  center_finding: Search,
  center_matching: GraduationCap,
  class_matching: Calendar,
  reservation_payment: Receipt,
  intro_sms: MessageSquare,
  care_home_finding: Hospital,
  visa_change: AlertCircle,
  recontact_needed: Phone,
};

type OwnerAccent = {
  iconBadge: string;
  countPill: string;
};

type OwnerSection = {
  title: string;
  keys: TaskBucket["key"][];
  accent: OwnerAccent;
};

const OWNER_SECTIONS: OwnerSection[] = [
  {
    title: "[대표님]",
    keys: ["center_finding", "care_home_finding"],
    accent: {
      iconBadge: "bg-primary/10 text-primary",
      countPill: "bg-primary text-primary-foreground",
    },
  },
  {
    title: "[완님]",
    keys: ["center_matching", "reservation_payment", "recontact_needed"],
    accent: {
      iconBadge: "bg-info/10 text-info",
      countPill: "bg-info text-white",
    },
  },
  {
    title: "[이사님]",
    keys: ["class_matching", "intro_sms", "visa_change"],
    accent: {
      iconBadge: "bg-success/10 text-success",
      countPill: "bg-success text-white",
    },
  },
];

const STORAGE_KEY = "glocare:dashboard-task-layout:v1";

type Layout = Record<string, TaskBucket["key"][]>;

function defaultLayout(): Layout {
  return Object.fromEntries(
    OWNER_SECTIONS.map((s) => [s.title, [...s.keys]])
  );
}

function reconcileLayout(
  saved: Layout,
  allKeys: TaskBucket["key"][]
): Layout {
  const result: Layout = Object.fromEntries(
    OWNER_SECTIONS.map((s) => [s.title, [] as TaskBucket["key"][]])
  );
  const placed = new Set<TaskBucket["key"]>();
  const validKeys = new Set(allKeys);

  for (const section of OWNER_SECTIONS) {
    const existing = saved[section.title] ?? [];
    for (const key of existing) {
      if (validKeys.has(key) && !placed.has(key)) {
        result[section.title].push(key);
        placed.add(key);
      }
    }
  }
  for (const key of allKeys) {
    if (!placed.has(key)) {
      const defaultSection =
        OWNER_SECTIONS.find((s) => s.keys.includes(key))?.title ??
        OWNER_SECTIONS[0].title;
      result[defaultSection].push(key);
      placed.add(key);
    }
  }
  return result;
}

/**
 * 섹션 간 이동/재정렬.
 * - fromSection === toSection: 같은 섹션 내 재정렬
 * - 다른 섹션: 이동 후 toSection 의 toIndex 위치에 삽입
 */
function moveLayout(
  layout: Layout,
  key: TaskBucket["key"],
  fromSection: string,
  toSection: string,
  toIndex: number
): Layout {
  if (fromSection === toSection) {
    const items = [...(layout[fromSection] ?? [])];
    const fromIndex = items.indexOf(key);
    if (fromIndex === -1 || fromIndex === toIndex) return layout;
    items.splice(fromIndex, 1);
    // 같은 섹션 내에서 위치가 뒤로 밀리면 인덱스 보정
    const adjusted = fromIndex < toIndex ? toIndex - 1 : toIndex;
    items.splice(adjusted, 0, key);
    return { ...layout, [fromSection]: items };
  }
  const fromItems = [...(layout[fromSection] ?? [])];
  const toItems = [...(layout[toSection] ?? [])];
  const fromIndex = fromItems.indexOf(key);
  if (fromIndex === -1) return layout;
  fromItems.splice(fromIndex, 1);
  const clampedIndex = Math.max(0, Math.min(toIndex, toItems.length));
  toItems.splice(clampedIndex, 0, key);
  return {
    ...layout,
    [fromSection]: fromItems,
    [toSection]: toItems,
  };
}

function findSection(layout: Layout, key: TaskBucket["key"]): string | null {
  for (const [section, keys] of Object.entries(layout)) {
    if (keys.includes(key)) return section;
  }
  return null;
}

export function TaskCards({ buckets }: { buckets: TaskBucket[] }) {
  const [layout, setLayout] = useState<Layout>(() => defaultLayout());
  const [hydrated, setHydrated] = useState(false);
  const [draggedKey, setDraggedKey] = useState<TaskBucket["key"] | null>(null);
  const [dragOverSection, setDragOverSection] = useState<string | null>(null);

  useEffect(() => {
    const allKeys = buckets.map((b) => b.key);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const base = saved ? (JSON.parse(saved) as Layout) : defaultLayout();
      setLayout(reconcileLayout(base, allKeys));
    } catch {
      setLayout(reconcileLayout(defaultLayout(), allKeys));
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    } catch {
      // quota 등 무시
    }
  }, [layout, hydrated]);

  const byKey = useMemo(
    () => new Map(buckets.map((b) => [b.key, b])),
    [buckets]
  );

  const handleDropOnCard = (
    targetKey: TaskBucket["key"],
    targetSection: string
  ) => {
    if (!draggedKey || draggedKey === targetKey) return;
    setLayout((prev) => {
      const fromSection = findSection(prev, draggedKey);
      if (!fromSection) return prev;
      const targetItems = prev[targetSection] ?? [];
      const targetIndex = targetItems.indexOf(targetKey);
      if (targetIndex === -1) return prev;
      return moveLayout(
        prev,
        draggedKey,
        fromSection,
        targetSection,
        targetIndex
      );
    });
  };

  const handleDropOnSection = (targetSection: string) => {
    if (!draggedKey) return;
    setLayout((prev) => {
      const fromSection = findSection(prev, draggedKey);
      if (!fromSection) return prev;
      if (fromSection === targetSection) return prev; // 같은 섹션 빈 공간 드롭은 무시
      const targetLen = (prev[targetSection] ?? []).length;
      return moveLayout(prev, draggedKey, fromSection, targetSection, targetLen);
    });
  };

  return (
    <div className="space-y-4">
      {OWNER_SECTIONS.map((section) => {
        const bucketKeys = layout[section.title] ?? [];
        const isOver = dragOverSection === section.title;
        return (
          <SectionRow
            key={section.title}
            title={section.title}
            bucketKeys={bucketKeys}
            buckets={byKey}
            accent={section.accent}
            draggedKey={draggedKey}
            isOver={isOver}
            enableDrag={hydrated}
            onDragStartCard={(key) => setDraggedKey(key)}
            onDragEndCard={() => {
              setDraggedKey(null);
              setDragOverSection(null);
            }}
            onDragEnterSection={() => setDragOverSection(section.title)}
            onDragLeaveSection={() =>
              setDragOverSection((curr) =>
                curr === section.title ? null : curr
              )
            }
            onDropCard={(targetKey) =>
              handleDropOnCard(targetKey, section.title)
            }
            onDropSection={() => handleDropOnSection(section.title)}
          />
        );
      })}
    </div>
  );
}

function SectionRow({
  title,
  bucketKeys,
  buckets,
  accent,
  draggedKey,
  isOver,
  enableDrag,
  onDragStartCard,
  onDragEndCard,
  onDragEnterSection,
  onDragLeaveSection,
  onDropCard,
  onDropSection,
}: {
  title: string;
  bucketKeys: TaskBucket["key"][];
  buckets: Map<TaskBucket["key"], TaskBucket>;
  accent: OwnerAccent;
  draggedKey: TaskBucket["key"] | null;
  isOver: boolean;
  enableDrag: boolean;
  onDragStartCard: (key: TaskBucket["key"]) => void;
  onDragEndCard: () => void;
  onDragEnterSection: () => void;
  onDragLeaveSection: () => void;
  onDropCard: (targetKey: TaskBucket["key"]) => void;
  onDropSection: () => void;
}) {
  const columnCount = Math.max(bucketKeys.length, 1);
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      <div
        className={`grid gap-2 rounded-md transition-colors ${
          isOver ? "bg-accent/30 ring-2 ring-primary/30" : ""
        }`}
        style={{
          gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
        }}
        onDragEnter={(e) => {
          if (draggedKey) {
            e.preventDefault();
            onDragEnterSection();
          }
        }}
        onDragOver={(e) => {
          if (draggedKey) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }
        }}
        onDragLeave={(e) => {
          // 하위 엘리먼트로 이동할 때는 무시
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            onDragLeaveSection();
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          // 카드 위 드롭은 Card 의 onDrop 에서 처리하므로 여기는 빈 공간용
          if (e.target === e.currentTarget) {
            onDropSection();
          }
        }}
      >
        {bucketKeys.length === 0 ? (
          <div className="text-[11px] text-muted-foreground/70 px-3 py-4 border border-dashed rounded-md text-center">
            여기로 드래그해서 놓으세요
          </div>
        ) : (
          bucketKeys.map((k) => {
            const bucket = buckets.get(k);
            if (!bucket) return null;
            return (
              <TaskCardDraggable
                key={k}
                bucket={bucket}
                accent={accent}
                enableDrag={enableDrag}
                isDragging={draggedKey === k}
                onDragStart={() => onDragStartCard(k)}
                onDragEnd={onDragEndCard}
                onDrop={() => onDropCard(k)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

function TaskCardDraggable({
  bucket,
  accent,
  enableDrag,
  isDragging,
  onDragStart,
  onDragEnd,
  onDrop,
}: {
  bucket: TaskBucket;
  accent: OwnerAccent;
  enableDrag: boolean;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
}) {
  const Icon = ICONS[bucket.key];
  const preview = bucket.customers.slice(0, 2);
  const previewNames = preview
    .map((c) => c.name_vi || c.name_kr || c.code)
    .join(", ");
  const extraCount = bucket.customers.length - preview.length;

  return (
    <div
      draggable={enableDrag}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        // Firefox 호환: 데이터 세팅 필요
        try {
          e.dataTransfer.setData("text/plain", bucket.key);
        } catch {
          // ignore
        }
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        if (enableDrag) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDrop();
      }}
      className={isDragging ? "opacity-40" : ""}
      style={{ cursor: enableDrag ? "grab" : "default" }}
    >
      <Link
        href={hrefFor(bucket.key)}
        draggable={false}
        className="block select-none"
      >
        <Card className="transition-colors hover:border-primary/50 hover:bg-accent/30 px-3 py-2.5">
          <div className="flex items-center gap-3">
            <div
              className={`size-7 rounded-md ${accent.iconBadge} flex items-center justify-center shrink-0`}
            >
              <Icon className="size-3.5" />
            </div>
            <span
              className={`inline-flex items-center justify-center rounded-full text-xs font-semibold h-6 min-w-6 px-2 shrink-0 tabular-nums ${accent.countPill}`}
            >
              {bucket.count}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground truncate">
                {bucket.label}
              </div>
              {previewNames && (
                <div className="mt-0.5 text-[11px] text-muted-foreground truncate">
                  {previewNames}
                  {extraCount > 0 ? ` 외 ${extraCount}명` : ""}
                </div>
              )}
            </div>
            <ChevronRight className="size-4 text-muted-foreground shrink-0" />
          </div>
        </Card>
      </Link>
    </div>
  );
}

function hrefFor(key: TaskBucket["key"]): string {
  return `/customers?bucket=${key}`;
}
