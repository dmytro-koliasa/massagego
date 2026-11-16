'use client';

import { useState } from 'react';
import { useLanguage } from '@/components/language-provider';
import {
	CLIENT_CANCEL_REASON_KEYS,
	type ClientCancelReasonKey,
} from '@/lib/client-booking-rules';
import { formatSlotDateTime } from '@/lib/calendar-time';
import { getMassageTypeLabel } from '@/lib/massage-types';

type CancelBookingDialogProps = {
	startIso: string;
	timeZone: string;
	massageType?: string | null;
	subtitle?: string;
	pending: boolean;
	onClose: () => void;
	onConfirm: (input: {
		cancelReason: ClientCancelReasonKey;
		cancelReasonText: string;
	}) => void;
};

function reasonLabel(
	key: ClientCancelReasonKey,
	t: ReturnType<typeof useLanguage>['t'],
) {
	switch (key) {
		case 'cant_make_it':
			return t.cancelReason_cant_make_it;
		case 'circumstances_changed':
			return t.cancelReason_circumstances_changed;
		case 'changed_mind':
			return t.cancelReason_changed_mind;
		case 'wrong_slot':
			return t.cancelReason_wrong_slot;
		case 'other':
			return t.cancelReason_other;
	}
}

export function CancelBookingDialog({
	startIso,
	timeZone,
	massageType,
	subtitle,
	pending,
	onClose,
	onConfirm,
}: CancelBookingDialogProps) {
	const { t, locale } = useLanguage();
	const [cancelReason, setCancelReason] = useState<ClientCancelReasonKey | ''>(
		'',
	);
	const [cancelReasonText, setCancelReasonText] = useState('');
	const [localError, setLocalError] = useState<string | null>(null);

	function submit() {
		if (!cancelReason) {
			setLocalError(t.bookingCancelReasonRequired);
			return;
		}
		if (cancelReason === 'other' && !cancelReasonText.trim()) {
			setLocalError(t.bookingCancelReasonOtherRequired);
			return;
		}
		setLocalError(null);
		onConfirm({
			cancelReason,
			cancelReasonText:
				cancelReason === 'other' ? cancelReasonText.trim() : '',
		});
	}

	return (
		<div
			className='fixed inset-0 z-[90] flex items-center justify-center bg-black/35 p-4'
			role='presentation'
			onClick={() => {
				if (!pending) onClose();
			}}
		>
			<div
				role='dialog'
				aria-modal='true'
				aria-labelledby='booking-cancel-title'
				className='w-full max-w-sm rounded-xl border border-surface-border bg-background p-5 shadow-[0_24px_60px_rgba(0,0,0,0.18)]'
				onClick={event => event.stopPropagation()}
			>
				<p
					id='booking-cancel-title'
					className='text-base font-medium text-foreground'
				>
					{t.bookingCancelConfirm}
				</p>
				<div className='mt-2 space-y-1 text-sm text-muted'>
					{subtitle ? <p>{subtitle}</p> : null}
					<p>{formatSlotDateTime(startIso, locale, timeZone)}</p>
					{massageType ? (
						<p>
							{t.bookingMassageType}:{' '}
							{getMassageTypeLabel(massageType, locale)}
						</p>
					) : null}
				</div>

				<label className='mt-4 block text-left'>
					<span className='mb-1.5 block text-sm text-muted'>
						{t.bookingCancelReasonLabel}
					</span>
					<select
						value={cancelReason}
						disabled={pending}
						onChange={event => {
							setCancelReason(
								event.target.value as ClientCancelReasonKey | '',
							);
							setLocalError(null);
						}}
						className='h-11 w-full rounded-lg border border-surface-border bg-background/70 px-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-[var(--ring)]'
					>
						<option value=''>{t.bookingCancelReasonPlaceholder}</option>
						{CLIENT_CANCEL_REASON_KEYS.map(key => (
							<option key={key} value={key}>
								{reasonLabel(key, t)}
							</option>
						))}
					</select>
				</label>

				{cancelReason === 'other' ? (
					<label className='mt-3 block text-left'>
						<textarea
							value={cancelReasonText}
							disabled={pending}
							maxLength={200}
							rows={3}
							placeholder={t.bookingCancelReasonOtherPlaceholder}
							onChange={event => {
								setCancelReasonText(event.target.value);
								setLocalError(null);
							}}
							className='w-full rounded-lg border border-surface-border bg-background/70 px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-[var(--ring)]'
						/>
					</label>
				) : null}

				{localError ? (
					<p className='mt-2 text-sm text-accent'>{localError}</p>
				) : null}

				<div className='mt-5 flex flex-wrap justify-end gap-2'>
					<button
						type='button'
						disabled={pending}
						onClick={onClose}
						className='h-11 rounded-lg border border-surface-border px-4 text-sm font-medium text-foreground transition hover:border-accent/40 disabled:opacity-60'
					>
						{t.bookingCancelKeep}
					</button>
					<button
						type='button'
						disabled={pending}
						onClick={submit}
						className='h-11 rounded-lg bg-accent px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60'
					>
						{pending ? t.authPleaseWait : t.bookingCancelConfirmAction}
					</button>
				</div>
			</div>
		</div>
	);
}

export function cutoffPassedMessage(
	phone: string | null | undefined,
	t: ReturnType<typeof useLanguage>['t'],
) {
	const trimmed = phone?.trim();
	if (trimmed) {
		return t.bookingCancelCutoffPassedWithPhone.replaceAll('{phone}', trimmed);
	}
	return t.bookingCancelCutoffPassed;
}

export function thaiNeighborCutoffMessage(
	phone: string | null | undefined,
	t: ReturnType<typeof useLanguage>['t'],
) {
	const trimmed = phone?.trim();
	if (trimmed) {
		return t.bookingThaiNeighborCutoffWithPhone.replaceAll('{phone}', trimmed);
	}
	return t.bookingThaiNeighborCutoff;
}
