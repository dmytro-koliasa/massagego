import Link from "next/link";

type BackNavLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
};

export function BackNavLink({ href, children, className = "" }: BackNavLinkProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 text-sm font-medium text-accent underline-offset-4 transition hover:underline ${className}`.trim()}
    >
      <BackIcon />
      {children}
    </Link>
  );
}

function BackIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 6 9 12l6 6" />
      <path d="M9 12h11" />
    </svg>
  );
}
