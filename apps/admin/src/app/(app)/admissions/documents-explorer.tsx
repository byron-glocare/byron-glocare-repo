"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardList, FileText, ImageIcon, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export type DocItem = {
  id: string;
  doc_type: "guideline" | "form" | "submission";
  university_id: number;
  university_name: string;
  department_label: string | null;
  name: string;
  status: string;
  updated_at: string;
};

type Filter = "all" | "guideline" | "form" | "submission";

const TYPE_META: Record<
  DocItem["doc_type"],
  { label: string; className: string }
> = {
  guideline: {
    label: "모집요강",
    className: "bg-sky-100 text-sky-700 border-sky-200",
  },
  form: {
    label: "양식",
    className: "bg-slate-100 text-slate-700 border-slate-200",
  },
  submission: {
    label: "직접제출",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
};

function statusLabel(docType: DocItem["doc_type"], status: string): string {
  if (docType === "form") {
    return status === "current" ? "현행" : "이력";
  }
  switch (status) {
    case "draft":
      return "초안";
    case "reviewing":
      return "검수 중";
    case "approved":
      return "승인";
    case "archived":
      return "보관";
    default:
      return status;
  }
}

function isApprovedLike(docType: DocItem["doc_type"], status: string): boolean {
  if (docType === "form") return status === "current";
  return status === "approved";
}

export function DocumentsExplorer({ documents }: { documents: DocItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const c = { all: documents.length, guideline: 0, form: 0, submission: 0 };
    for (const d of documents) c[d.doc_type] += 1;
    return c;
  }, [documents]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents
      .filter((d) => (filter === "all" ? true : d.doc_type === filter))
      .filter((d) =>
        q === ""
          ? true
          : d.name.toLowerCase().includes(q) ||
            d.university_name.toLowerCase().includes(q) ||
            (d.department_label?.toLowerCase().includes(q) ?? false)
      )
      .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
  }, [documents, filter, query]);

  const chips: Array<{ key: Filter; label: string; count: number }> = [
    { key: "all", label: "전체", count: counts.all },
    { key: "guideline", label: "모집요강", count: counts.guideline },
    { key: "form", label: "양식", count: counts.form },
    { key: "submission", label: "직접제출", count: counts.submission },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setFilter(c.key)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                filter === c.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {c.label} {c.count}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="문서명·대학·학과 검색"
            className="w-56 rounded-md border border-input bg-background py-1.5 pl-8 pr-3 text-sm"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          조건에 맞는 문서가 없습니다.
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="w-24 px-3 py-2 font-medium">종류</th>
                <th className="px-3 py-2 font-medium">문서명</th>
                <th className="w-44 px-3 py-2 font-medium">대학 · 범위</th>
                <th className="w-20 px-3 py-2 text-center font-medium">상태</th>
                <th className="w-24 px-3 py-2 font-medium">갱신</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const meta = TYPE_META[d.doc_type];
                const Icon =
                  d.doc_type === "guideline"
                    ? ClipboardList
                    : d.doc_type === "form"
                      ? FileText
                      : ImageIcon;
                return (
                  <tr key={`${d.doc_type}-${d.id}`} className="border-t">
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.className}`}
                      >
                        <Icon className="size-3" />
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/admissions/${d.university_id}`}
                        className="font-medium hover:text-primary"
                      >
                        {d.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      <Link
                        href={`/admissions/${d.university_id}`}
                        className="hover:text-primary"
                      >
                        {d.university_name}
                        {d.department_label ? ` · ${d.department_label}` : ""}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {isApprovedLike(d.doc_type, d.status) ? (
                        <Badge className="bg-success/10 text-success border-success/20 text-[10px]">
                          {statusLabel(d.doc_type, d.status)}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          {statusLabel(d.doc_type, d.status)}
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {d.updated_at
                        ? new Date(d.updated_at).toLocaleDateString("ko-KR")
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
