'use client';

import type { createNativeValidationHandlers } from '@/lib/native-validation';
import { formControlClassName } from '@/lib/ui-classes';

type ValidationHandlers = ReturnType<typeof createNativeValidationHandlers>;

export function TextField({
	id,
	label,
	type,
	value,
	onChange,
	autoComplete,
	required,
	minLength,
	maxLength,
	validation,
}: {
	id: string;
	label: string;
	type: string;
	value: string;
	onChange: (value: string) => void;
	autoComplete?: string;
	required?: boolean;
	minLength?: number;
	maxLength?: number;
	validation?: ValidationHandlers;
}) {
	return (
		<label className='block text-left'>
			<span className='mb-1.5 block text-sm text-muted'>{label}</span>
			<input
				id={id}
				name={id}
				type={type}
				value={value}
				autoComplete={autoComplete}
				required={required}
				minLength={minLength}
				maxLength={maxLength}
				onInvalid={validation?.onInvalid}
				onInput={validation?.onInput}
				onChange={event => onChange(event.target.value)}
				className={formControlClassName}
			/>
		</label>
	);
}

export function PasswordField({
	id,
	label,
	value,
	onChange,
	autoComplete,
	required,
	minLength,
	maxLength,
	validation,
	visible,
	onToggleVisible,
	showLabel,
	hideLabel,
}: {
	id: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
	autoComplete?: string;
	required?: boolean;
	minLength?: number;
	maxLength?: number;
	validation?: ValidationHandlers;
	visible: boolean;
	onToggleVisible: () => void;
	showLabel: string;
	hideLabel: string;
}) {
	return (
		<label className='block text-left'>
			<span className='mb-1.5 block text-sm text-muted'>{label}</span>
			<div className='relative'>
				<input
					id={id}
					name={id}
					type={visible ? 'text' : 'password'}
					value={value}
					autoComplete={autoComplete}
					required={required}
					minLength={minLength}
					maxLength={maxLength}
					onInvalid={validation?.onInvalid}
					onInput={validation?.onInput}
					onChange={event => onChange(event.target.value)}
					className={`${formControlClassName} pr-12`}
				/>
				<button
					type='button'
					onClick={onToggleVisible}
					aria-label={visible ? hideLabel : showLabel}
					className='absolute top-1/2 right-3 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted transition hover:text-foreground'
				>
					{visible ? <EyeOffIcon /> : <EyeIcon />}
				</button>
			</div>
		</label>
	);
}

function EyeIcon() {
	return (
		<svg width='18' height='18' viewBox='0 0 24 24' fill='none' aria-hidden>
			<path
				d='M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z'
				stroke='currentColor'
				strokeWidth='1.6'
				strokeLinejoin='round'
			/>
			<circle cx='12' cy='12' r='2.75' stroke='currentColor' strokeWidth='1.6' />
		</svg>
	);
}

function EyeOffIcon() {
	return (
		<svg width='18' height='18' viewBox='0 0 24 24' fill='none' aria-hidden>
			<path
				d='M3 3l18 18'
				stroke='currentColor'
				strokeWidth='1.6'
				strokeLinecap='round'
			/>
			<path
				d='M10.6 10.7a2.75 2.75 0 0 0 3.7 3.7M9.5 5.2A10.6 10.6 0 0 1 12 5c6 0 9.5 7 9.5 7a16.7 16.7 0 0 1-3.2 3.9M6.2 6.3C4.1 7.8 2.5 12 2.5 12s3.5 7 9.5 7c1.5 0 2.9-.4 4.1-1'
				stroke='currentColor'
				strokeWidth='1.6'
				strokeLinecap='round'
				strokeLinejoin='round'
			/>
		</svg>
	);
}
