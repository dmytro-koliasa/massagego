'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useLanguage } from '@/components/language-provider';
import { portalHomePath, type Portal } from '@/lib/portals';

type Props = {
	portal: Portal;
};

export function DeleteAccountSection({ portal }: Props) {
	const { t } = useLanguage();
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [pending, setPending] = useState(false);
	const [blockedCount, setBlockedCount] = useState<number | null>(null);

	async function confirmDelete() {
		setPending(true);
		setBlockedCount(null);
		try {
			const response = await fetch('/api/account/delete', { method: 'POST' });
			const data = (await response.json().catch(() => null)) as {
				error?: string;
				futureBookingCount?: number;
			} | null;

			if (!response.ok) {
				if (data?.error === 'masseur_has_future_bookings') {
					setBlockedCount(data.futureBookingCount ?? 0);
					setOpen(false);
					return;
				}
				toast.error(t.deleteAccountError);
				return;
			}

			toast.success(t.deleteAccountSuccess);
			setOpen(false);
			await signOut({
				redirect: false,
				callbackUrl: portalHomePath(portal),
			});
			router.replace(portalHomePath(portal));
			router.refresh();
		} catch {
			toast.error(t.deleteAccountError);
		} finally {
			setPending(false);
		}
	}

	return (
		<section className='mt-8 rounded-2xl border border-red-500/30 bg-surface p-4 sm:p-6'>
			<h2 className='text-base font-semibold text-foreground'>
				{t.deleteAccountTitle}
			</h2>
			<p className='mt-1 text-sm text-muted'>{t.deleteAccountSupport}</p>
			{blockedCount !== null ? (
				<p className='mt-3 text-sm text-foreground'>
					{t.deleteAccountMasseurBlocked.replace('{n}', String(blockedCount))}{' '}
					<Link
						href='/masseur/dashboard'
						className='text-accent underline-offset-2 hover:underline'
					>
						{t.deleteAccountOpenCalendar}
					</Link>
				</p>
			) : null}
			<button
				type='button'
				disabled={pending}
				onClick={() => setOpen(true)}
				className='mt-4 h-10 rounded-[var(--radius-control)] border border-red-600/50 px-4 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-950/40'
			>
				{t.deleteAccountButton}
			</button>
			<ConfirmDialog
				open={open}
				title={t.deleteAccountConfirmTitle}
				message={t.deleteAccountConfirmMessage}
				confirmLabel={t.deleteAccountConfirmAction}
				cancelLabel={t.deleteAccountCancel}
				pending={pending}
				danger
				onCancel={() => setOpen(false)}
				onConfirm={() => void confirmDelete()}
			/>
		</section>
	);
}
