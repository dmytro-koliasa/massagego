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
				homeOnDark
					? 'border-[rgba(240,171,252,0.18)] bg-[#05050a] text-[rgba(163,158,180,0.95)]'
					: isHome
						? 'border-[var(--landing-border)] bg-[var(--landing-bg)] text-[var(--landing-muted)]'
						: 'border-surface-border bg-background text-muted'
			}`}
		>
			<div className='mx-auto flex w-full max-w-5xl flex-wrap items-center justify-center gap-4 px-[15px] py-6 text-sm'>
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
