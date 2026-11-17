'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BackNavLink } from '@/components/back-nav-link';
import { useLanguage } from '@/components/language-provider';
import type { NotificationEventType } from '@/lib/notifications/types';

type PrefRow = {
	eventType: NotificationEventType;
	emailEnabled: boolean;
	emailLocked: boolean;
	telegramEnabled: boolean;
	telegramLocked: boolean;
};

type TelegramState = {
	connected: boolean;
	phoneConfirmed: boolean;
	hasPhone: boolean;
	configured: boolean;
	botUsername: string | null;
};

const EVENT_LABEL_KEYS: Record<
	NotificationEventType,
	| 'notifEventBookingCreated'
	| 'notifEventCancelledByClient'
	| 'notifEventCancelledByMasseur'
	| 'notifEventCancelledClientDeleted'
	| 'notifEventBookingConfirmed'
	| 'notifEventBookingReminder'
> = {
	booking_created: 'notifEventBookingCreated',
	booking_cancelled_by_client: 'notifEventCancelledByClient',
	booking_cancelled_by_masseur: 'notifEventCancelledByMasseur',
	booking_cancelled_client_deleted: 'notifEventCancelledClientDeleted',
	booking_confirmed: 'notifEventBookingConfirmed',
	booking_reminder: 'notifEventBookingReminder',
};

type Props = {
	backHref: string;
};

export function NotificationSettingsView({ backHref }: Props) {
	const { t } = useLanguage();
	const [preferences, setPreferences] = useState<PrefRow[]>([]);
	const [telegram, setTelegram] = useState<TelegramState | null>(null);
	const [loading, setLoading] = useState(true);
	const [pending, setPending] = useState(false);

	async function load() {
		setLoading(true);
		try {
			const response = await fetch('/api/notifications/preferences');
			if (!response.ok) throw new Error('load_failed');
			const data = (await response.json()) as {
				preferences: PrefRow[];
				telegram: TelegramState;
			};
			setPreferences(data.preferences);
			setTelegram(data.telegram);
		} catch {
			toast.error(t.notifLoadError);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			if (cancelled) return;
			await load();
		})();
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps -- reload on locale label change only
	}, [t.notifLoadError]);

	async function toggle(
		eventType: NotificationEventType,
		patch: { emailEnabled?: boolean; telegramEnabled?: boolean },
	) {
		const current = preferences.find(row => row.eventType === eventType);
		if (!current) return;
		if (patch.emailEnabled !== undefined && current.emailLocked) return;
		if (patch.telegramEnabled !== undefined && current.telegramLocked) return;

		setPending(true);
		const previous = preferences;
		setPreferences(rows =>
			rows.map(row =>
				row.eventType === eventType ? { ...row, ...patch } : row,
			),
		);
		try {
			const response = await fetch('/api/notifications/preferences', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					preferences: [{ eventType, ...patch }],
				}),
			});
			if (!response.ok) {
				const data = (await response.json().catch(() => null)) as {
					error?: string;
				} | null;
				if (
					data?.error === 'critical_channel_required' ||
					data?.error === 'critical_email_required'
				) {
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

	async function connectTelegram() {
		setPending(true);
		try {
			const response = await fetch('/api/telegram/link', { method: 'POST' });
			const data = (await response.json().catch(() => null)) as {
				url?: string;
				error?: string;
			} | null;
			if (!response.ok || !data?.url) {
				toast.error(
					data?.error === 'telegram_not_configured'
						? t.telegramNotConfigured
						: t.telegramConnectError,
				);
				return;
			}
			window.open(data.url, '_blank', 'noopener,noreferrer');
			toast.success(t.telegramConnect);
		} catch {
			toast.error(t.telegramConnectError);
		} finally {
			setPending(false);
		}
	}

	async function disconnectTelegram() {
		setPending(true);
		try {
			const response = await fetch('/api/telegram/disconnect', {
				method: 'POST',
			});
			if (!response.ok) {
				toast.error(t.telegramDisconnectError);
				return;
			}
			await load();
			toast.success(t.telegramDisconnect);
		} catch {
			toast.error(t.telegramDisconnectError);
		} finally {
			setPending(false);
		}
	}

	async function confirmPhone() {
		setPending(true);
		try {
			const response = await fetch('/api/telegram/confirm-phone', {
				method: 'POST',
			});
			if (!response.ok) {
				toast.error(t.telegramConfirmError);
				return;
			}
			toast.success(t.telegramConfirmPhone);
		} catch {
			toast.error(t.telegramConfirmError);
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
					<h2 className='text-base font-semibold text-foreground'>
						{t.telegramSectionTitle}
					</h2>
					{loading || !telegram ? (
						<p className='mt-3 text-sm text-muted'>{t.notifLoading}</p>
					) : (
						<div className='mt-3 space-y-3'>
							<p className='text-sm text-muted'>
								{telegram.connected
									? t.telegramConnected
									: t.telegramNotConnected}
								{telegram.connected
									? ` · ${
											telegram.phoneConfirmed
												? t.telegramPhoneConfirmed
												: t.telegramPhoneNotConfirmed
										}`
									: null}
							</p>
							<p className='text-xs text-muted'>
								{t.telegramPrivacyNotice}{' '}
								<Link href='/privacy' className='text-accent underline-offset-2 hover:underline'>
									{t.telegramPrivacyLink}
								</Link>{' '}
								{t.telegramAnd}{' '}
								<Link href='/terms' className='text-accent underline-offset-2 hover:underline'>
									{t.telegramTermsLink}
								</Link>
								.
							</p>
							<div className='flex flex-wrap gap-2'>
								{!telegram.connected ? (
									<button
										type='button'
										disabled={pending || !telegram.configured}
										onClick={() => void connectTelegram()}
										className='rounded-[var(--radius-control)] bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60'
									>
										{t.telegramConnect}
									</button>
								) : (
									<>
										<button
											type='button'
											disabled={pending}
											onClick={() => void disconnectTelegram()}
											className='rounded-[var(--radius-control)] border border-surface-border px-3 py-2 text-sm text-foreground disabled:opacity-60'
										>
											{t.telegramDisconnect}
										</button>
										{!telegram.phoneConfirmed && telegram.hasPhone ? (
											<button
												type='button'
												disabled={pending}
												onClick={() => void confirmPhone()}
												className='rounded-[var(--radius-control)] border border-surface-border px-3 py-2 text-sm text-foreground disabled:opacity-60'
											>
												{t.telegramConfirmPhone}
											</button>
										) : null}
									</>
								)}
							</div>
							{!telegram.configured ? (
								<p className='text-xs text-muted'>{t.telegramNotConfigured}</p>
							) : null}
						</div>
					)}
				</section>

				<section className='mt-6 rounded-2xl border border-surface-border bg-surface p-4 sm:p-6'>
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
										className='flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between'
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
											{row.telegramLocked && !telegram?.connected ? (
												<p className='mt-1 text-xs text-muted'>
													{t.notifTelegramLockedHint}
												</p>
											) : null}
										</div>
										<div className='flex shrink-0 flex-col gap-2 sm:items-end'>
											<label className='flex items-center gap-2 text-sm text-foreground'>
												<span className='text-muted'>{t.notifChannelEmail}</span>
												<input
													type='checkbox'
													checked={row.emailEnabled}
													disabled={pending || row.emailLocked}
													onChange={event =>
														void toggle(row.eventType, {
															emailEnabled: event.target.checked,
														})
													}
													className='h-4 w-4 accent-[var(--accent)]'
												/>
											</label>
											<label className='flex items-center gap-2 text-sm text-foreground'>
												<span className='text-muted'>
													{t.notifChannelTelegram}
												</span>
												<input
													type='checkbox'
													checked={row.telegramEnabled}
													disabled={pending || row.telegramLocked}
													onChange={event =>
														void toggle(row.eventType, {
															telegramEnabled: event.target.checked,
														})
													}
													className='h-4 w-4 accent-[var(--accent)]'
												/>
											</label>
										</div>
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
