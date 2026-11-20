/** Same-origin in-app navigations that should show the global Preloader (#158). */
export function isInAppPageNavigation(
	href: string,
	current: { origin: string; pathname: string; search: string },
): boolean {
	let url: URL;
	try {
		url = new URL(href, current.origin);
	} catch {
		return false;
	}
	if (url.origin !== current.origin) return false;
	if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
		return false;
	}
	// Same path+query (including hash-only) — not a page transition.
	if (url.pathname === current.pathname && url.search === current.search) {
		return false;
	}
	return true;
}

/** Avoid flash on instant transitions (#158). */
export const NAV_PRELOADER_SHOW_DELAY_MS = 120;
/** Safety clear if the route never commits. */
export const NAV_PRELOADER_MAX_PENDING_MS = 12_000;

export type NavigationPendingSnapshot = {
	pending: boolean;
	visible: boolean;
};

const idleSnapshot: NavigationPendingSnapshot = {
	pending: false,
	visible: false,
};

let snapshot: NavigationPendingSnapshot = idleSnapshot;
const listeners = new Set<() => void>();
let delayTimer: ReturnType<typeof setTimeout> | null = null;
let maxTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
	for (const listener of listeners) listener();
}

function clearTimers() {
	if (delayTimer) {
		clearTimeout(delayTimer);
		delayTimer = null;
	}
	if (maxTimer) {
		clearTimeout(maxTimer);
		maxTimer = null;
	}
}

export function startNavigationPending() {
	if (snapshot.pending) return;
	clearTimers();
	snapshot = { pending: true, visible: false };
	emit();
	delayTimer = setTimeout(() => {
		if (!snapshot.pending) return;
		snapshot = { pending: true, visible: true };
		emit();
	}, NAV_PRELOADER_SHOW_DELAY_MS);
	maxTimer = setTimeout(() => {
		clearNavigationPending();
	}, NAV_PRELOADER_MAX_PENDING_MS);
}

export function clearNavigationPending() {
	clearTimers();
	if (!snapshot.pending && !snapshot.visible) return;
	snapshot = idleSnapshot;
	emit();
}

export function subscribeNavigationPending(onStoreChange: () => void) {
	listeners.add(onStoreChange);
	return () => {
		listeners.delete(onStoreChange);
	};
}

export function getNavigationPendingSnapshot() {
	return snapshot;
}

export function getNavigationPendingServerSnapshot() {
	return idleSnapshot;
}
