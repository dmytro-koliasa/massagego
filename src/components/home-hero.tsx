'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '@/components/language-provider';

const HERO_IMAGE =
	'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=2400&q=80';

export function HomeHero() {
	const { t } = useLanguage();

	return (
		<section className='landing-hero relative min-h-[calc(100dvh-4rem)] overflow-hidden bg-[var(--landing-bg)] text-[var(--landing-fg)]'>
			<div className='pointer-events-none absolute inset-0'>
				<Image
					src={HERO_IMAGE}
					alt=''
					fill
					priority
					sizes='100vw'
					aria-hidden
					className='animate-ken-burns object-cover object-center opacity-35'
				/>
				<div
					className='absolute inset-0'
					style={{
						background:
							'radial-gradient(ellipse 80% 60% at 70% 20%, rgba(168,85,247,0.28), transparent 55%), radial-gradient(ellipse 70% 50% at 15% 80%, rgba(232,121,249,0.18), transparent 50%), linear-gradient(180deg, rgba(5,5,10,0.55) 0%, rgba(5,5,10,0.88) 45%, #05050a 100%)',
					}}
				/>
				<div className='animate-soft-pulse absolute -left-20 top-1/4 h-80 w-80 rounded-full bg-[var(--landing-glow)] blur-3xl' />
				<div className='animate-soft-pulse absolute -right-16 bottom-1/4 h-72 w-72 rounded-full bg-[rgba(232,121,249,0.2)] blur-3xl' style={{ animationDelay: '1.2s' }} />
			</div>

			<div className='relative z-10 mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-6xl flex-col justify-end gap-12 px-[15px] pb-12 pt-28 sm:justify-center sm:pb-16'>
				<div className='max-w-3xl space-y-5'>
					<p
						className='animate-fade-up font-display text-[clamp(3rem,9vw,5.75rem)] font-semibold leading-[0.92] tracking-[-0.04em] text-white'
						style={{ animationDelay: '80ms' }}
					>
						MassageGo
					</p>
					<h1
						className='animate-fade-up font-display text-[clamp(1.35rem,3.5vw,2.15rem)] font-medium leading-snug tracking-[-0.02em] text-white/90'
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
					/>
					<PathCard
						href='/client/login'
						title={t.clientTitle}
						description={t.clientDescription}
						tag={t.headerPortalClient}
						imageAlt={t.heroAlt}
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
}: {
	href: string;
	title: string;
	description: string;
	tag: string;
	imageAlt: string;
}) {
	return (
		<Link
			href={href}
			className='group relative flex flex-col overflow-hidden rounded-md border border-[var(--landing-border)] bg-[var(--landing-card)] shadow-[0_0_0_1px_rgba(240,171,252,0.08),0_0_40px_rgba(168,85,247,0.12)] backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:border-[var(--landing-accent)] hover:shadow-[0_0_0_1px_rgba(240,171,252,0.35),0_0_48px_rgba(232,121,249,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)]'
		>
			<div className='relative h-40 w-full overflow-hidden sm:h-44'>
				<Image
					src={HERO_IMAGE}
					alt={imageAlt}
					fill
					sizes='(max-width: 640px) 100vw, 50vw'
					className='object-cover object-center transition duration-500 group-hover:scale-[1.04]'
				/>
				<div className='absolute inset-0 bg-gradient-to-t from-[rgba(5,5,10,0.85)] via-transparent to-transparent' />
			</div>

			<div className='flex flex-1 flex-col gap-3 px-4 py-4 sm:px-5 sm:py-5'>
				<div className='space-y-2'>
					<span className='block font-display text-lg font-semibold uppercase tracking-[0.06em] text-white sm:text-xl'>
						{title}
					</span>
					<span className='block text-sm leading-relaxed text-[var(--landing-muted)]'>
						{description}
					</span>
				</div>

				<div className='mt-auto flex items-end justify-between gap-3 pt-2'>
					<span className='rounded-sm border border-[var(--landing-border)] px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--landing-accent)]'>
						{tag}
					</span>
					<span
						aria-hidden
						className='inline-flex h-9 w-9 items-center justify-center rounded-sm border border-[var(--landing-border)] text-[var(--landing-accent)] transition duration-300 group-hover:translate-x-0.5 group-hover:border-[var(--landing-accent)] group-hover:bg-[rgba(232,121,249,0.12)]'
					>
						↗
					</span>
				</div>
			</div>
		</Link>
	);
}
