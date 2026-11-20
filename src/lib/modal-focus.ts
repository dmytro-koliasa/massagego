const FOCUSABLE_SELECTOR = [
	'a[href]',
	'button:not([disabled])',
	'input:not([disabled]):not([type="hidden"])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'[tabindex]:not([tabindex="-1"])',
].join(',');

function isElementVisible(el: HTMLElement): boolean {
	if (el.hidden || el.getAttribute('aria-hidden') === 'true') return false;
	const style = window.getComputedStyle(el);
	if (style.display === 'none' || style.visibility === 'hidden') return false;
	return el.getClientRects().length > 0;
}

export function getFocusableElements(root: HTMLElement): HTMLElement[] {
	return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
		(el) => !el.hasAttribute('disabled') && isElementVisible(el),
	);
}

export function focusFirstElement(root: HTMLElement): void {
	const focusables = getFocusableElements(root);
	const target = focusables[0] ?? root;
	target.focus();
}

/** Keeps Tab / Shift+Tab inside `root`. Returns true when the event was handled. */
export function trapTabKey(event: KeyboardEvent, root: HTMLElement): boolean {
	if (event.key !== 'Tab') return false;
	const focusables = getFocusableElements(root);
	if (focusables.length === 0) {
		event.preventDefault();
		root.focus();
		return true;
	}
	const first = focusables[0]!;
	const last = focusables[focusables.length - 1]!;
	const active = document.activeElement as HTMLElement | null;
	if (event.shiftKey) {
		if (active === first || !root.contains(active)) {
			event.preventDefault();
			last.focus();
			return true;
		}
		return false;
	}
	if (active === last || !root.contains(active)) {
		event.preventDefault();
		first.focus();
		return true;
	}
	return false;
}
