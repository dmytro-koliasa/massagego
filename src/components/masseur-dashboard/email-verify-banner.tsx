import type { Dictionary } from '@/lib/i18n';

type EmailVerifyBannerProps = {
	t: Dictionary;
	resendPending: boolean;
	onResend: () => void;
};

export function EmailVerifyBanner({ t, resendPending, onResend }: EmailVerifyBannerProps) {
	return (
		<div className='mt-8 rounded-xl border border-accent/30 bg-accent-soft/40 p-4 text-left sm:p-5'>
			<h2 className='text-base font-semibold text-foreground'>
				{t.masseurEmailVerifyBannerTitle}
			</h2>
			<p className='mt-1 text-sm text-muted'>{t.masseurEmailVerifyBannerSupport}</p>
			<button
				type='button'
				disabled={resendPending}
				onClick={onResend}
				className='mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-60'
			>
				{t.masseurEmailVerifyResend}
			</button>
		</div>
	);
}