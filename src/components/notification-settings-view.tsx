'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BackNavLink } from '@/components/back-nav-link';
import { useLanguage } from '@/components/language-provider';
import type { NotificationEventType } from '@/lib/notifications/types';

type PrefRow = {
	eventType: NotificationEventType;
	emailEnabled: boolean;
	emailLocked: boolean;
};

const EVENT_LABEL_KEYS: Record<
	NotificationEventType,
	| 'notifEventBookingCreated'
	| 'notifEventCancelledByClient'
	| 'notifEventCancelledByMasseur'
	| 'notifEventCancelledClientDeleted'
	| 'notifEventBookingConfirmed'
> = {
	booking_created: 'notifEventBookingCreated',
	booking_cancelled_by_client: 'notifEventCancelledByClient',
	booking_cancelled_by_masseur: 'notifEventCancelledByMasseur',
	booking_cancelled_client_deleted: 'notifEventCancelledClientDeleted',
	booking_confirmed: 'notifEventBookingConfirmed',
};

type Props = {
	backHref: string;
};

export function NotificationSettingsView({ backHref }: Props) {
	const { t } = useLanguage();
	const [preferences, setPreferences] = useState<PrefRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [pending, setPending] = useState(false);

	useEffect(() => {
		let cancelled = false;
		async function load() {
			setLoading(true);
			try {
				const response = await fetch('/api/notifications/preferences');
				if (!response.ok) throw new Error('load_failed');
				const data = (await response.json()) as { preferences: PrefRow[] };
				if (!cancelled) setPreferences(data.preferences);
			} catch {
				if (!cancelled) toast.error(t.notifLoadError);
			} finally {
				if (!cancelled) setLoading(false);
			}
		}
		void load();
		return () => {
			cancelled = true;
		};
	}, [t.notifLoadError]);

	async function toggle(eventType: NotificationEventType, emailEnabled: boolean) {
		const current = preferences.find(row => row.eventType === eventType);
		if (!current || current.emailLocked) return;

		setPending(true);
		const previous = preferences;
		setPreferences(rows =>
			rows.map(row =>
				row.eventType === eventType ? { ...row, emailEnabled } : row,
			),
		);
		try {
			const response = await fetch('/api/notifications/preferences', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					preferences: [{ eventType, emailEnabled }],
				}),
			});
			if (!response.ok) {
				const data = (await response.json().catch(() => null)) as {
					error?: string;
				} | null;
				if (data?.error === 'critical_email_required') {
					toast.error(t.notifCriticalEmailRequired);
				} else {
					toast.error(t.notifSaveError);
				}
				setPreferences(previous);
				return;
			}
			const data = (await response.json()) as { preferences: PrefRow[] };
			setPreferences(data.preferences);
			toast.success(t.notifSaveSuccess);
		} catch {
			setPreferences(previous);
			toast.error(t.notifSaveError);
		} finally {
			setPending(false);
		}
	}

	return (
		<main className='flex flex-1 flex-col bg-background py-10'>
			<div className='mx-auto w-full max-w-2xl flex-1 px-[15px]'>
				<BackNavLink href={backHref}>{t.notifBack}</BackNavLink>
				<div className='mt-6 max-w-2xl space-y-3'>
					<h1 className='font-display text-4xl tracking-[-0.03em] text-foreground sm:text-5xl'>
						{t.notifPageTitle}
					</h1>
					<p className='text-sm text-muted'>{t.notifPageSupport}</p>
				</div>

				<section className='mt-8 rounded-2xl border border-surface-border bg-surface p-4 sm:p-6'>
					{loading ? (
						<p className='text-sm text-muted'>{t.notifLoading}</p>
					) : preferences.length === 0 ? (
						<p className='text-sm text-muted'>{t.notifLoadError}</p>
					) : (
						<ul className='divide-y divide-surface-border'>
							{preferences.map(row => {
								const labelKey = EVENT_LABEL_KEYS[row.eventType];
								return (
									<li
										key={row.eventType}
										className='flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0'
									>
										<div className='min-w-0'>
											<p className='text-sm font-medium text-foreground'>
												{t[labelKey]}
											</p>
											{row.emailLocked ? (
												<p className='mt-1 text-xs text-muted'>
													{t.notifEmailLockedHint}
												</p>
											) : null}
										</div>
										<label className='flex shrink-0 items-center gap-2 text-sm text-foreground'>
											<span className='text-muted'>{t.notifChannelEmail}</span>
											<input
												type='checkbox'
												checked={row.emailEnabled}
												disabled={pending || row.emailLocked}
												onChange={event =>
													void toggle(row.eventType, event.target.checked)
												}
												className='h-4 w-4 accent-[var(--accent)]'
											/>
										</label>
									</li>
								);
							})}
						</ul>
					)}
				</section>
			</div>
		</main>
	);
}
