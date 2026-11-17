'use client';

import Link from 'next/link';
import { useLanguage } from '@/components/language-provider';

export function SiteFooter() {
	const { t } = useLanguage();
	return (
		<footer className='mt-auto border-t border-surface-border bg-background'>
			<div className='mx-auto flex w-full max-w-5xl flex-wrap items-center justify-center gap-4 px-[15px] py-6 text-sm text-muted'>
				<Link
					href='/privacy'
					className='underline-offset-2 transition hover:text-foreground hover:underline'
				>
					{t.footerPrivacy}
				</Link>
				<Link
					href='/terms'
					className='underline-offset-2 transition hover:text-foreground hover:underline'
				>
					{t.footerTerms}
				</Link>
			</div>
		</footer>
	);
}
