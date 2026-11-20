'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/components/language-provider';
import { Preloader } from '@/components/preloader';
import {
	clearNavigationPending,
	getNavigationPendingServerSnapshot,
	getNavigationPendingSnapshot,
	isInAppPageNavigation,
	startNavigationPending,
	subscribeNavigationPending,
} from '@/lib/navigation-pending';

function isModifiedClick(event: MouseEvent) {
	return (
		event.metaKey ||
		event.ctrlKey ||
		event.shiftKey ||
		event.altKey ||
		event.button !== 0
	);
}

export function NavigationPreloader() {
	const pathname = usePathname();
	const { t } = useLanguage();
	const { visible } = useSyncExternalStore(
		subscribeNavigationPending,
		getNavigationPendingSnapshot,
		getNavigationPendingServerSnapshot,
	);

	useEffect(() => {
		clearNavigationPending();
	}, [pathname]);

	useEffect(() => {
		const onClick = (event: MouseEvent) => {
			if (isModifiedClick(event)) return;
			const target = event.target;
			if (!(target instanceof Element)) return;
			const anchor = target.closest('a');
			if (!(anchor instanceof HTMLAnchorElement)) return;
			if (anchor.target && anchor.target !== '_self') return;
			if (anchor.hasAttribute('download')) return;
			const href = anchor.getAttribute('href');
			if (!href) return;
			if (
				!isInAppPageNavigation(href, {
					origin: window.location.origin,
					pathname: window.location.pathname,
					search: window.location.search,
				})
			) {
				return;
			}
			startNavigationPending();
		};

		const onPopState = () => {
			startNavigationPending();
		};

		document.addEventListener('click', onClick, true);
		window.addEventListener('popstate', onPopState);
		return () => {
			document.removeEventListener('click', onClick, true);
			window.removeEventListener('popstate', onPopState);
		};
	}, []);

	if (!visible) return null;

	return (
		<div
			className='fixed inset-0 z-[100] flex items-center justify-center bg-background/92 backdrop-blur-md'
			role='status'
			aria-live='polite'
			aria-busy='true'
		>
			<Preloader label={t.authPleaseWait} />
		</div>
	);
}
