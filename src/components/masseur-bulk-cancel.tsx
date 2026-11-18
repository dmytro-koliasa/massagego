'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/language-provider';

type Props = {
	onCancelled?: () => void;
};

function subscribeHash(onStoreChange: () => void) {
	window.addEventListener('hashchange', onStoreChange);
	return () => window.removeEventListener('hashchange', onStoreChange);
}

function getBulkCancelHash() {
	return window.location.hash === '#bulk-cancel';
}

function getBulkCancelHashServer() {
	return false;
}

export function MasseurBulkCancel({ onCancelled }: Props) {
	const { t } = useLanguage();
	const hashAutoOpen = useSyncExternalStore(
		subscribeHash,
		getBulkCancelHash,
		getBulkCancelHashServer,
	);
	const [open, setOpen] = useState(false);
	const [pending, setPending] = useState(false);
	const [loadingCount, setLoadingCount] = useState(false);
	const [count, setCount] = useState<number | null>(null);
	const [availability, setAvailability] = useState<'available' | 'unavailable'>(
		'available',
	);
	const [autoOpenDone, setAutoOpenDone] = useState(false);

	const loadCount = useCallback(async () => {
		setLoadingCount(true);
		try {
			const response = await fetch('/api/masseur/bookings/bulk-cancel');
			if (!response.ok) throw new Error('load_failed');
			const data = (await response.json()) as { count?: number };
			const next = typeof data.count === 'number' ? data.count : 0;
			setCount(next);
			return next;
		} catch {
			toast.error(t.bulkCancelLoadError);
			setCount(null);
			return null;
		} finally {
			setLoadingCount(false);
		}
	}, [t.bulkCancelLoadError]);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			const response = await fetch('/api/masseur/bookings/bulk-cancel');
			if (cancelled) return;
			if (!response.ok) {
				toast.error(t.bulkCancelLoadError);
				setCount(null);
				return;
			}
			const data = (await response.json()) as { count?: number };
			if (cancelled) return;
			setCount(typeof data.count === 'number' ? data.count : 0);
		})();
		return () => {
			cancelled = true;
		};
	}, [t.bulkCancelLoadError]);

	useEffect(() => {
		if (!hashAutoOpen || autoOpenDone) return;
		let cancelled = false;
		void (async () => {
			const response = await fetch('/api/masseur/bookings/bulk-cancel');
			if (cancelled) return;
			if (!response.ok) return;
			const data = (await response.json()) as { count?: number };
			const next = typeof data.count === 'number' ? data.count : 0;
			if (cancelled) return;
			setCount(next);
			setAutoOpenDone(true);
			if (next > 0) setOpen(true);
		})();
		return () => {
			cancelled = true;
		};
	}, [hashAutoOpen, autoOpenDone]);

	async function openDialog() {
		const n = await loadCount();
		if (n === null) return;
		if (n === 0) {
			toast.message(t.bulkCancelNone);
			return;
		}
		setAvailability('available');
		setOpen(true);
	}

	async function confirm() {
		if (!count || count <= 0) return;
		setPending(true);
		try {
			const response = await fetch('/api/masseur/bookings/bulk-cancel', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ availability }),
			});
			const data = (await response.json().catch(() => null)) as {
				error?: string;
				cancelledCount?: number;
			} | null;

			if (!response.ok) {
				if (data?.error === 'none_found') {
					toast.message(t.bulkCancelNone);
					setCount(0);
					setOpen(false);
					return;
				}
				toast.error(t.bulkCancelError);
				return;
			}

			const cancelled = data?.cancelledCount ?? count;
			toast.success(
				(availability === 'available'
					? t.bulkCancelSuccessAvailable
					: t.bulkCancelSuccessUnavailable
				).replace('{n}', String(cancelled)),
			);
			setCount(0);
			setOpen(false);
			onCancelled?.();
		} catch {
			toast.error(t.bulkCancelError);
		} finally {
			setPending(false);
		}
	}

	return (
		<section
			id='bulk-cancel'
			className='mt-8 scroll-mt-24 rounded-2xl border border-surface-border bg-surface p-4 sm:p-6'
		>
			<div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
				<div>
					<h2 className='text-base font-semibold text-foreground'>
						{t.bulkCancelTitle}
					</h2>
					<p className='mt-1 text-sm text-muted'>{t.bulkCancelSupport}</p>
					{count !== null ? (
						<p className='mt-2 text-sm text-foreground'>
							{t.bulkCancelCount.replace('{n}', String(count))}
						</p>
					) : null}
				</div>
				<button
					type='button'
					disabled={pending || loadingCount || count === 0}
					onClick={() => void openDialog()}
					className='h-10 shrink-0 rounded-[var(--radius-control)] border border-red-600/50 px-4 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-950/40'
				>
					{loadingCount ? t.authPleaseWait : t.bulkCancelButton}
				</button>
			</div>

			{open ? (
				<div className='fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4'>
					<div
						role='dialog'
						aria-modal='true'
						aria-labelledby='bulk-cancel-title'
						className='w-full max-w-md rounded-2xl border border-surface-border bg-surface p-5 shadow-lg'
					>
						<h2
							id='bulk-cancel-title'
							className='text-lg font-semibold text-foreground'
						>
							{t.bulkCancelConfirmTitle.replace('{n}', String(count ?? 0))}
						</h2>
						<p className='mt-2 text-sm leading-relaxed text-muted'>
							{t.bulkCancelConfirmMessage}
						</p>

						<fieldset className='mt-4 space-y-2'>
							<legend className='text-sm font-medium text-foreground'>
								{t.bulkCancelAvailabilityLegend}
							</legend>
							<label className='flex items-center gap-2 text-sm text-foreground'>
								<input
									type='radio'
									name='bulk-cancel-availability'
									checked={availability === 'available'}
									onChange={() => setAvailability('available')}
									disabled={pending}
									className='accent-[var(--accent)]'
								/>
								{t.bulkCancelKeepAvailable}
							</label>
							<label className='flex items-center gap-2 text-sm text-foreground'>
								<input
									type='radio'
									name='bulk-cancel-availability'
									checked={availability === 'unavailable'}
									onChange={() => setAvailability('unavailable')}
									disabled={pending}
									className='accent-[var(--accent)]'
								/>
								{t.bulkCancelMakeUnavailable}
							</label>
						</fieldset>

						<div className='mt-5 flex flex-wrap justify-end gap-2'>
							<button
								type='button'
								disabled={pending}
								onClick={() => setOpen(false)}
								className='h-10 rounded-[var(--radius-control)] border border-surface-border px-4 text-sm text-foreground disabled:opacity-60'
							>
								{t.bulkCancelCancel}
							</button>
							<button
								type='button'
								disabled={pending}
								onClick={() => void confirm()}
								className='h-10 rounded-[var(--radius-control)] bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60'
							>
								{pending ? '…' : t.bulkCancelConfirmAction}
							</button>
						</div>
					</div>
				</div>
			) : null}
		</section>
	);
}
