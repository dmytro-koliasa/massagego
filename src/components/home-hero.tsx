'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect } from 'react';
import { useLanguage } from '@/components/language-provider';

const HERO_IMAGE =
	'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=2400&q=80';
const MASSEUR_CARD_IMAGE = '/media/masseur-card.jpg';
const CLIENT_CARD_IMAGE = '/media/client-card.jpg';

export function HomeHero() {
	const { t } = useLanguage();

	// Keep home scroll locked for client navigations; clear on leave so other routes can scroll.
	useEffect(() => {
		const html = document.documentElement;
		const body = document.body;
		html.style.overflow = 'hidden';
		body.style.overflow = 'hidden';
		return () => {
			html.style.overflow = '';
			body.style.overflow = '';
		};
	}, []);

	return (
		<section className='relative h-full overflow-hidden bg-[var(--landing-bg)] text-[var(--landing-fg)]'>
			{/* Full-bleed media plane — under sticky header/footer, edge-to-edge (both themes) */}
			<div className='pointer-events-none absolute inset-0'>
				<Image
					src={HERO_IMAGE}
					alt=''
					fill
					priority
					sizes='100vw'
					aria-hidden
					className='animate-ken-burns object-cover object-center'
					style={{ opacity: 'var(--landing-photo-opacity)' }}
				/>
				<div
					className='absolute inset-0'
					style={{ background: 'var(--landing-overlay)' }}
				/>
				<div className='animate-soft-pulse absolute -left-20 top-1/4 h-80 w-80 rounded-full bg-[var(--landing-glow)] blur-3xl' />
				<div
					className='animate-soft-pulse absolute -right-16 bottom-1/4 h-72 w-72 rounded-full bg-[var(--landing-glow)] blur-3xl'
					style={{ animationDelay: '1.2s' }}
				/>
			</div>

			{/* Vertically centered between fixed header (4.25rem) and home footer (3.5rem / 4rem) */}
			<div className='relative z-10 mx-auto flex h-full w-full max-w-6xl flex-col justify-center gap-10 px-[15px] pb-[calc(3.5rem+1.5rem)] pt-[calc(4.25rem+1.5rem)] sm:gap-12 sm:pb-[calc(4rem+2rem)] sm:pt-[calc(4.25rem+2rem)]'>
				<div className='max-w-3xl space-y-5'>
					<p
						className='animate-fade-up font-display text-[clamp(3rem,9vw,5.75rem)] font-semibold leading-[0.92] tracking-[-0.04em] text-[var(--landing-title)]'
						style={{ animationDelay: '80ms' }}
					>
						MassageGo
					</p>
					<h1
						className='animate-fade-up font-display text-[clamp(1.35rem,3.5vw,2.15rem)] font-medium leading-snug tracking-[-0.02em] text-[var(--landing-fg)]'
						style={{ animationDelay: '160ms' }}
					>
						{t.headlineLine1}{' '}
						<span className='text-[var(--landing-accent)]'>{t.headlineLine2}</span>
					</h1>
					<p
						className='animate-fade-up max-w-lg text-base leading-relaxed text-[var(--landing-muted)] sm:text-lg'
						style={{ animationDelay: '240ms' }}
					>
						{t.heroSupport}
					</p>
				</div>

				<div
					className='animate-fade-up grid gap-4 sm:grid-cols-2 sm:gap-5'
					style={{ animationDelay: '340ms' }}
					role='group'
					aria-label={t.roleGroupLabel}
				>
					<PathCard
						href='/masseur/login'
						title={t.masseurTitle}
						description={t.masseurDescription}
						tag={t.headerPortalMasseur}
						imageAlt={t.heroAlt}
						imageSrc={MASSEUR_CARD_IMAGE}
					/>
					<PathCard
						href='/client/login'
						title={t.clientTitle}
						description={t.clientDescription}
						tag={t.headerPortalClient}
						imageAlt={t.heroAlt}
						imageSrc={CLIENT_CARD_IMAGE}
					/>
				</div>
			</div>
		</section>
	);
}

function PathCard({
	href,
	title,
	description,
	tag,
	imageAlt,
	imageSrc = HERO_IMAGE,
}: {
	href: string;
	title: string;
	description: string;
	tag: string;
	imageAlt: string;
	imageSrc?: string;
}) {
	return (
		<Link
			href={href}
			className='landing-path-card group relative flex flex-col overflow-hidden rounded-md border border-[var(--landing-border)] bg-[var(--landing-card)] backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:border-[var(--landing-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)]'
		>
			<div className='relative h-40 w-full overflow-hidden sm:h-44'>
				<Image
					src={imageSrc}
					alt={imageAlt}
					fill
					sizes='(max-width: 640px) 100vw, 50vw'
					className='scale-105 object-cover object-center blur-[2.5px]'
				/>
				<div
					className='pointer-events-none absolute inset-0'
					style={{ background: 'var(--landing-image-fade)' }}
				/>
				{/* Solid seam so hover transforms don't flicker against the text block */}
				<div
					aria-hidden
					className='pointer-events-none absolute inset-x-0 bottom-0 h-3 bg-[var(--landing-card)]'
				/>
			</div>

			<div className='flex flex-1 flex-col gap-3 px-4 py-4 sm:px-5 sm:py-5'>
				<div className='space-y-2'>
					<span className='block font-display text-lg font-semibold uppercase tracking-[0.06em] text-[var(--landing-title)] sm:text-xl'>
						{title}
					</span>
					<span className='block text-[calc(0.875rem+2px)] leading-relaxed text-[var(--landing-muted)]'>
						{description}
					</span>
				</div>

				<div className='mt-auto flex items-center justify-between gap-3 pt-2'>
					<span className='inline-flex h-9 items-center rounded-sm border border-[var(--landing-border)] px-[13px] text-[calc(0.65rem+1px)] font-semibold uppercase tracking-[0.14em] text-[var(--landing-accent)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--landing-accent)_12%,transparent),0_1px_6px_color-mix(in_srgb,var(--landing-accent)_22%,transparent)] transition duration-300 group-hover:border-[var(--landing-accent)] group-hover:bg-[var(--accent-soft)]'>
						{tag}
					</span>
					<span
						aria-hidden
						className='inline-flex h-9 w-9 items-center justify-center rounded-sm border border-[var(--landing-border)] text-[var(--landing-accent)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--landing-accent)_12%,transparent),0_1px_6px_color-mix(in_srgb,var(--landing-accent)_22%,transparent)] transition duration-300 group-hover:translate-x-0.5 group-hover:border-[var(--landing-accent)] group-hover:bg-[var(--accent-soft)]'
					>
						↗
					</span>
				</div>
			</div>
		</Link>
	);
}
