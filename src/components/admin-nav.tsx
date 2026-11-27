"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/language-provider";

/**
 * Client island: admin title + active-tab nav (#207 AD-1).
 * Kept client for pathname active state and live locale switching.
 */
export function AdminNav() {
  const { t } = useLanguage();
  const pathname = usePathname();

  const usersActive =
    pathname === "/admin" || pathname.startsWith("/admin/users");
  const complaintsActive = pathname.startsWith("/admin/complaints");
  const auditActive = pathname.startsWith("/admin/audit");
  const passwordActive = pathname.startsWith("/admin/password");

  return (
    <>
      <div className="space-y-2">
        <h1 className="font-display text-3xl tracking-[-0.03em] text-foreground sm:text-4xl">
          {t.adminPageTitle}
        </h1>
      </div>
      <nav
        aria-label={t.adminPageTitle}
        className="mt-6 flex gap-2 border-b border-surface-border pb-px"
      >
        <Link
          href="/admin"
          className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
            usersActive
              ? "border-accent text-foreground"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          {t.adminNavUsers}
        </Link>
        <Link
          href="/admin/complaints"
          className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
            complaintsActive
              ? "border-accent text-foreground"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          {t.adminNavComplaints}
        </Link>
        <Link
          href="/admin/audit"
          className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
            auditActive
              ? "border-accent text-foreground"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          {t.adminNavAudit}
        </Link>
        <Link
          href="/admin/password"
          className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
            passwordActive
              ? "border-accent text-foreground"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          {t.adminNavPassword}
        </Link>
      </nav>
    </>
  );
}
