'use client';

import {
	useEffect,
	useRef,
	type MouseEvent as ReactMouseEvent,
	type ReactNode,
} from 'react';
import { focusFirstElement, trapTabKey } from '@/lib/modal-focus';

type ModalDialogProps = {
	open: boolean;
	onClose: () => void;
	/** When true, Escape and overlay click do not close. */
	closeDisabled?: boolean;
	labelledBy?: string;
	label?: string;
	overlayClassName?: string;
	panelClassName?: string;
	closeOnOverlayClick?: boolean;
	children: ReactNode;
};

export function ModalDialog({
	open,
	onClose,
	closeDisabled = false,
	labelledBy,
	label,
	overlayClassName = 'fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4',
	panelClassName = 'w-full max-w-md rounded-2xl border border-surface-border bg-surface p-5 shadow-lg',
	closeOnOverlayClick = true,
	children,
}: ModalDialogProps) {
	const panelRef = useRef<HTMLDivElement>(null);
	const previousFocusRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		if (!open) return;

		previousFocusRef.current =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;

		const panel = panelRef.current;
		if (panel) {
			focusFirstElement(panel);
		}

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				if (closeDisabled) return;
				event.preventDefault();
				onClose();
				return;
			}
			if (panel) {
				trapTabKey(event, panel);
			}
		};

		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('keydown', onKeyDown);
			const previous = previousFocusRef.current;
			if (previous && typeof previous.focus === 'function') {
				previous.focus();
			}
		};
	}, [open, closeDisabled, onClose]);

	if (!open) return null;

	function onOverlayClick(event: ReactMouseEvent<HTMLDivElement>) {
		if (!closeOnOverlayClick || closeDisabled) return;
		if (event.target === event.currentTarget) {
			onClose();
		}
	}

	return (
		<div
			className={overlayClassName}
			role='presentation'
			onClick={onOverlayClick}
		>
			<div
				ref={panelRef}
				role='dialog'
				aria-modal='true'
				aria-labelledby={labelledBy}
				aria-label={labelledBy ? undefined : label}
				tabIndex={-1}
				className={panelClassName}
				onClick={(event) => event.stopPropagation()}
			>
				{children}
			</div>
		</div>
	);
}
