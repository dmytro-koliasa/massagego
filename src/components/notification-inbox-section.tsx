'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/language-provider';
import type { NotificationEventType } from '@/lib/notifications/types';
import { portalRequestHeaders, type PublicPortal } from '@/lib/portals';

type InboxItem = {
	id: string;
	eventType: NotificationEventType;
	title: string;
	body: string;
	href: string;
	readAt: string | null;
	createdAt: string;
	bookingId: string | null;
};

export type InboxSeed = {
	items: InboxItem[];
	nextCursor: string | null;
};

type Props = {
	portal: PublicPortal;
	initialInbox?: InboxSeed;
};

function formatWhen(iso: string, locale: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	return new Intl.DateTimeFormat(locale === 'uk' ? 'uk-UA' : 'en-GB', {
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(date);
}

export function NotificationInboxSection({ portal, initialInbox }: Props) {
	const { t, locale } = useLanguage();
	const router = useRouter();
	const [items, setItems] = useState<InboxItem[]>(initialInbox?.items ?? []);
	const [nextCursor, setNextCursor] = useState<string | null>(
		initialInbox?.nextCursor ?? null,
	);
	const [loading, setLoading] = useState(!initialInbox);
	const [loadingMore, setLoadingMore] = useState(false);
	const [pending, setPending] = useState(false);
	const portalHeaders = portalRequestHeaders(portal);
	const seeded = Boolean(initialInbox);

	async function load(cursor?: string | null) {
		const url = cursor
			? `/api/notifications/inbox?cursor=${encodeURIComponent(cursor)}`
			: '/api/notifications/inbox';
		const response = await fetch(url, { headers: portalHeaders });
		if (!response.ok) throw new Error('load_failed');
		return (await response.json()) as {
			items: InboxItem[];
			nextCursor: string | null;
		};
	}

	useEffect(() => {
		if (seeded) return;
		let cancelled = false;
		void (async () => {
			setLoading(true);
			try {
				const data = await load();
				if (cancelled) return;
				setItems(data.items);
				setNextCursor(data.nextCursor);
			} catch {
				if (!cancelled) toast.error(t.notifInboxLoadError);
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps -- seed skips hydrate fetch; else reload on locale label change
	}, [t.notifInboxLoadError, seeded]);

	async function loadMore() {
		if (!nextCursor || loadingMore) return;
		setLoadingMore(true);
		try {
			const data = await load(nextCursor);
			setItems(prev => [...prev, ...data.items]);
			setNextCursor(data.nextCursor);
		} catch {
			toast.error(t.notifInboxLoadError);
		} finally {
			setLoadingMore(false);
		}
	}

	async function markAllRead() {
		setPending(true);
		try {
			const response = await fetch('/api/notifications/inbox/mark-all-read', {
				method: 'POST',
				headers: portalHeaders,
			});
			if (!response.ok) throw new Error('mark_failed');
			setItems(prev =>
				prev.map(item =>
					item.readAt
						? item
						: { ...item, readAt: new Date().toISOString() },
				),
			);
			toast.success(t.notifMarkAllReadSuccess);
		} catch {
			toast.error(t.notifMarkAllReadError);
		} finally {
			setPending(false);
		}
	}

	async function openItem(item: InboxItem) {
		if (!item.readAt) {
			try {
				await fetch(`/api/notifications/inbox/${item.id}/read`, {
					method: 'POST',
					headers: portalHeaders,
				});
				setItems(prev =>
					prev.map(row =>
						row.id === item.id
							? { ...row, readAt: new Date().toISOString() }
							: row,
					),
				);
			} catch {
				/* still navigate */
			}
		}
		router.push(item.href);
	}

	const unreadCount = items.filter(item => !item.readAt).length;

	return (
		<section className='mt-8 rounded-2xl border border-surface-border bg-surface p-4 sm:p-6'>
			<div className='flex flex-wrap items-start justify-between gap-3'>
				<div>
					<h2 className='text-base font-semibold text-foreground'>
						{t.notifInboxTitle}
					</h2>
					<p className='mt-1 text-sm text-muted'>{t.notifInboxSupport}</p>
				</div>
				{unreadCount > 0 ? (
					<button
						type='button'
						disabled={pending}
						onClick={() => void markAllRead()}
						className='rounded-[var(--radius-control)] border border-surface-border px-3 py-2 text-sm text-foreground disabled:opacity-60'
					>
						{t.notifMarkAllRead}
					</button>
				) : null}
			</div>

			{loading ? (
				<p className='mt-4 text-sm text-muted'>{t.notifInboxLoading}</p>
			) : items.length === 0 ? (
				<p className='mt-4 text-sm text-muted'>{t.notifInboxEmpty}</p>
			) : (
				<ul className='mt-4 divide-y divide-surface-border'>
					{items.map(item => {
						const unread = !item.readAt;
						return (
							<li key={item.id} className='py-3 first:pt-0 last:pb-0'>
								<button
									type='button'
									onClick={() => void openItem(item)}
									className='flex w-full flex-col gap-1 rounded-[var(--radius-control)] px-1 py-1 text-left hover:bg-background/60'
								>
									<div className='flex items-start justify-between gap-3'>
										<p
											className={`text-sm ${
												unread
													? 'font-semibold text-foreground'
													: 'font-medium text-foreground'
											}`}
										>
											{unread ? (
												<span
													className='mr-2 inline-block h-2 w-2 rounded-full bg-accent align-middle'
													aria-hidden
												/>
											) : null}
											{item.title}
										</p>
										<span className='shrink-0 text-xs text-muted'>
											{formatWhen(item.createdAt, locale)}
										</span>
									</div>
									<p className='whitespace-pre-line text-sm text-muted'>
										{item.body}
									</p>
								</button>
							</li>
						);
					})}
				</ul>
			)}

			{nextCursor ? (
				<button
					type='button'
					disabled={loadingMore}
					onClick={() => void loadMore()}
					className='mt-4 text-sm font-medium text-accent underline-offset-4 hover:underline disabled:opacity-60'
				>
					{loadingMore ? t.notifInboxLoading : t.notifInboxLoadMore}
				</button>
			) : null}
		</section>
	);
}
