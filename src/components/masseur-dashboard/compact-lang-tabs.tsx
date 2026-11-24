export function CompactLangTabs({
	ariaLabel,
	value,
	onChange,
	enLabel,
	ukLabel,
}: {
	ariaLabel: string;
	value: 'en' | 'uk';
	onChange: (value: 'en' | 'uk') => void;
	enLabel: string;
	ukLabel: string;
}) {
	return (
		<div
			role='tablist'
			aria-label={ariaLabel}
			className='inline-flex items-center rounded bg-accent-soft p-0.5'
		>
			<button
				type='button'
				role='tab'
				aria-selected={value === 'uk'}
				onClick={() => onChange('uk')}
				className={`rounded-sm px-2.5 py-1 text-[11px] font-medium tracking-[0.06em] transition ${
					value === 'uk'
						? 'bg-background text-foreground shadow-sm'
						: 'text-muted hover:text-foreground'
				}`}
			>
				{ukLabel}
			</button>
			<button
				type='button'
				role='tab'
				aria-selected={value === 'en'}
				onClick={() => onChange('en')}
				className={`rounded-sm px-2.5 py-1 text-[11px] font-medium tracking-[0.06em] transition ${
					value === 'en'
						? 'bg-background text-foreground shadow-sm'
						: 'text-muted hover:text-foreground'
				}`}
			>
				{enLabel}
			</button>
		</div>
	);
}