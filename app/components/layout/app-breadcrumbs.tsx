"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

function prettifySegment(segment: string) {
  if (!segment) return "Dashboard";

  if (segment === "clients") return "Clients";
  if (segment === "payments") return "Payments";
  if (segment === "expenses") return "Expenses";
  if (segment === "payroll") return "Payroll";
  if (segment === "analytics") return "Analytics";
  if (segment === "settings") return "Settings";

  return segment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

interface AppBreadcrumbsProps {
  items?: BreadcrumbItem[];
}

export function AppBreadcrumbs({ items }: AppBreadcrumbsProps) {
  const pathname = usePathname();

  const segments = pathname.split("/").filter(Boolean);

  const autoCrumbs: BreadcrumbItem[] = [
    { label: "Dashboard", href: "/" },
    ...segments.map((segment, index) => {
      const href = "/" + segments.slice(0, index + 1).join("/");
      return {
        label: prettifySegment(segment),
        href,
      };
    }),
  ];

  const crumbs = items && items.length > 0 ? items : autoCrumbs;
  const isRoot = pathname === "/" && (!items || items.length === 0);

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-white/35">
      {isRoot ? (
        <span className="text-white/45"></span>
      ) : (
        crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;

          return (
            <div key={`${crumb.href ?? crumb.label}-${index}`} className="flex items-center gap-2">
              {isLast || !crumb.href ? (
                <span className="text-white/55">{crumb.label}</span>
              ) : (
                <Link
                  href={crumb.href}
                  className="transition hover:text-white/70"
                >
                  {crumb.label}
                </Link>
              )}

              {!isLast ? <span className="text-white/20">/</span> : null}
            </div>
          );
        })
      )}
    </div>
  );
}