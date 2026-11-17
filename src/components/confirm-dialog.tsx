'use client';

type ConfirmDialogProps = {
	open: boolean;
	title: string;
	message: string;
	confirmLabel: string;
	cancelLabel: string;
	pending?: boolean;
	danger?: boolean;
	onConfirm: () => void;
	onCancel: () => void;
};

export function ConfirmDialog({
	open,
	title,
	message,
	confirmLabel,
	cancelLabel,
	pending = false,
	danger = false,
	onConfirm,
	onCancel,
}: ConfirmDialogProps) {
	if (!open) return null;

	return (
		<div className='fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4'>
			<div
				role='dialog'
				aria-modal='true'
				aria-labelledby='confirm-dialog-title'
				className='w-full max-w-md rounded-2xl border border-surface-border bg-surface p-5 shadow-lg'
			>
				<h2
					id='confirm-dialog-title'
					className='text-lg font-semibold text-foreground'
				>
					{title}
				</h2>
				<p className='mt-2 text-sm leading-relaxed text-muted'>{message}</p>
				<div className='mt-5 flex flex-wrap justify-end gap-2'>
					<button
						type='button'
						disabled={pending}
						onClick={onCancel}
						className='h-10 rounded-[var(--radius-control)] border border-surface-border px-4 text-sm text-foreground disabled:opacity-60'
					>
						{cancelLabel}
					</button>
					<button
						type='button'
						disabled={pending}
						onClick={onConfirm}
						className={`h-10 rounded-[var(--radius-control)] px-4 text-sm font-medium text-white disabled:opacity-60 ${
							danger ? 'bg-red-600 hover:bg-red-700' : 'bg-accent hover:opacity-90'
						}`}
					>
						{pending ? '…' : confirmLabel}
					</button>
				</div>
			</div>
		</div>
	);
}
