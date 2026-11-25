'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/components/language-provider';

export function SiteFooter() {
	const { t } = useLanguage();
	const pathname = usePathname();
	const isHome = pathname === '/';

	return (
		<footer
			className={`mt-auto border-t ${
				isHome
					? 'border-[rgba(240,171,252,0.18)] bg-[#05050a] text-[rgba(163,158,180,0.95)]'
					: 'border-surface-border bg-background text-muted'
			}`}
		>
			<div className='mx-auto flex w-full max-w-5xl flex-wrap items-center justify-center gap-4 px-[15px] py-6 text-sm'>
				<Link
					href='/privacy'
					className={`underline-offset-2 transition hover:underline ${
						isHome ? 'hover:text-white' : 'hover:text-foreground'
					}`}
				>
					{t.footerPrivacy}
				</Link>
				<Link
					href='/terms'
					className={`underline-offset-2 transition hover:underline ${
						isHome ? 'hover:text-white' : 'hover:text-foreground'
					}`}
				>
					{t.footerTerms}
				</Link>
			</div>
		</footer>
	);
}
