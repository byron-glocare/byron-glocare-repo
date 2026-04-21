import { ChevronRight } from "lucide-react";
import Link from "next/link";

type Crumb = { href?: string; label: string };

type Props = {
  title: string;
  description?: React.ReactNode;
  breadcrumbs?: Crumb[];
  actions?: React.ReactNode;
};

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
}: Props) {
  return (
    <div className="border-b border-border bg-card px-6 py-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2 min-w-0">
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav className="flex items-center gap-1 text-xs text-muted-foreground">
              {breadcrumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-1">
                  {c.href ? (
                    <Link
                      href={c.href}
                      className="hover:text-foreground transition-colors"
                    >
                      {c.label}
                    </Link>
                  ) : (
                    <span>{c.label}</span>
                  )}
                  {i < breadcrumbs.length - 1 && (
                    <ChevronRight className="size-3" />
                  )}
                </span>
              ))}
            </nav>
          )}
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
    </div>
  );
}
