'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/components/language-provider';
import {
	IN_APP_NOTIFICATION_BADGE_CAP,
	IN_APP_NOTIFICATION_POLL_MS,
} from '@/lib/booking-constants';
import { portalRequestHeaders, type PublicPortal } from '@/lib/portals';

type Props = {
	href: string;
	portal: PublicPortal;
};

function formatBadge(count: number): string {
	if (count <= 0) return '';
	if (count > IN_APP_NOTIFICATION_BADGE_CAP) {
		return `${IN_APP_NOTIFICATION_BADGE_CAP}+`;
	}
	return String(count);
}

export function NotificationNavLink({ href, portal }: Props) {
	const { t } = useLanguage();
	const [count, setCount] = useState(0);

	useEffect(() => {
		let cancelled = false;

		async function load() {
			try {
				const response = await fetch(
					'/api/notifications/inbox/unread-count',
					{ headers: portalRequestHeaders(portal) },
				);
				if (!response.ok) return;
				const data = (await response.json()) as { count?: number };
				if (!cancelled && typeof data.count === 'number') {
					setCount(data.count);
				}
			} catch {
				/* ignore transient poll errors */
			}
		}

		void load();
		const timer = window.setInterval(() => {
			void load();
		}, IN_APP_NOTIFICATION_POLL_MS);

		return () => {
			cancelled = true;
			window.clearInterval(timer);
		};
	}, [portal]);

	const badge = formatBadge(count);

	return (
		<Link
			href={href}
			className='inline-flex items-center gap-2 text-sm font-medium text-accent underline-offset-4 hover:underline'
		>
			<span>{t.notifNavLink}</span>
			{badge ? (
				<span
					className='inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white'
					aria-label={t.notifUnreadBadgeLabel.replace('{count}', String(count))}
				>
					{badge}
				</span>
			) : null}
		</Link>
	);
}
