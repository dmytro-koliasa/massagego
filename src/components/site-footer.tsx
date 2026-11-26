'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/components/language-provider';
import { useTheme } from '@/components/theme-provider';

export function SiteFooter() {
	const { t } = useLanguage();
	const { theme } = useTheme();
	const pathname = usePathname();
	const isHome = pathname === '/';
	const homeOnDark = isHome && theme === 'dark';

	return (
		<footer
			className={`mt-auto border-t ${
				isHome
					? 'fixed inset-x-0 bottom-0 z-50 backdrop-blur-xl'
					: ''
			} ${
				homeOnDark
					? 'border-[rgba(240,171,252,0.18)] bg-[rgba(5,5,10,0.42)] text-[rgba(163,158,180,0.95)]'
					: isHome
						? 'border-[var(--landing-border)] bg-[color-mix(in_srgb,var(--landing-bg)_55%,transparent)] text-[var(--landing-muted)]'
						: 'border-surface-border bg-background text-muted'
			}`}
		>
			<div
				className={`mx-auto flex w-full max-w-5xl flex-wrap items-center justify-center gap-4 px-[15px] text-sm ${
					isHome ? 'h-14 sm:h-16' : 'py-6'
				}`}
			>
				<Link
					href='/privacy'
					className={`underline-offset-2 transition hover:underline ${
						homeOnDark
							? 'hover:text-white'
							: isHome
								? 'hover:text-[var(--landing-title)]'
								: 'hover:text-foreground'
					}`}
				>
					{t.footerPrivacy}
				</Link>
				<Link
					href='/terms'
					className={`underline-offset-2 transition hover:underline ${
						homeOnDark
							? 'hover:text-white'
							: isHome
								? 'hover:text-[var(--landing-title)]'
								: 'hover:text-foreground'
					}`}
				>
					{t.footerTerms}
				</Link>
			</div>
		</footer>
	);
}
