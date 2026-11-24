'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '@/components/language-provider';

const HERO_IMAGE =
	'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=2400&q=80';

export function HomeHero() {
	const { t } = useLanguage();

	return (
		<section className='relative min-h-[calc(100dvh-4rem)] overflow-hidden'>
			<div className='absolute inset-0'>
				<Image
					src={HERO_IMAGE}
					alt={t.heroAlt}
					fill
					priority
					sizes='100vw'
					className='animate-ken-burns object-cover object-center'
				/>
				<div className='absolute inset-0' style={{ background: 'var(--hero-scrim)' }} />
				<div className='animate-soft-pulse absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-[var(--glow)] blur-3xl' />
			</div>

			<div className='relative z-10 flex min-h-[calc(100dvh-4rem)] flex-col justify-end pb-10 pt-24 sm:justify-center sm:pb-16'>
				<div className='mx-auto flex w-full max-w-6xl px-[15px]'>
					<div className='flex max-w-2xl flex-col gap-10 lg:max-w-3xl'>
						<div className='space-y-6'>
							<p
								className='animate-fade-up font-display text-[clamp(3.25rem,10vw,6.5rem)] leading-[0.9] tracking-[-0.04em] text-white'
								style={{ animationDelay: '80ms' }}
							>
								MassageGo
							</p>
							<h1
								className='animate-fade-up font-display text-[clamp(1.75rem,4.5vw,2.75rem)] leading-[1.05] tracking-[-0.02em] text-white/92'
								style={{ animationDelay: '160ms' }}
							>
								{t.headlineLine1}{' '}
								<span className='text-white/72'>{t.headlineLine2}</span>
							</h1>
							<p
								className='animate-fade-up max-w-md text-base leading-relaxed text-white/75 sm:text-lg'
								style={{ animationDelay: '240ms' }}
							>
								{t.heroSupport}
							</p>
						</div>

						<div
							className='animate-fade-up flex flex-col gap-3 sm:flex-row sm:gap-5'
							style={{ animationDelay: '340ms' }}
							role='group'
							aria-label={t.roleGroupLabel}
						>
							<PathLink
								href='/masseur/login'
								title={t.masseurTitle}
								description={t.masseurDescription}
							/>
							<PathLink
								href='/client/login'
								title={t.clientTitle}
								description={t.clientDescription}
							/>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

function PathLink({
	href,
	title,
	description,
}: {
	href: string;
	title: string;
	description: string;
}) {
	return (
		<Link
			href={href}
			className='group min-w-0 flex-1 border-t border-white/25 pt-4 text-left text-white transition hover:border-white/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50'
		>
			<span className='block font-display text-2xl tracking-[-0.02em] sm:text-[1.65rem]'>
				{title}
				<span
					aria-hidden
					className='ml-2 inline-block transition duration-300 group-hover:translate-x-1'
				>
					→
				</span>
			</span>
			<span className='mt-2 block max-w-xs text-sm leading-relaxed text-white/65'>
				{description}
			</span>
		</Link>
	);
}
