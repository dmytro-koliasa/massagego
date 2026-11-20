/**
 * Shared form control styles (#161).
 * Fields stay square (no radius) so phone / city / text inputs match.
 */
export const formControlClassName =
	'box-border h-12 w-full rounded-none border border-surface-border bg-background px-4 py-0 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-[var(--ring)]';

export const formControlButtonClassName =
	'box-border inline-flex h-12 shrink-0 items-center justify-center rounded-none border border-surface-border bg-background px-4 py-0 text-sm font-medium leading-none text-foreground transition hover:border-accent/50 hover:text-accent disabled:opacity-60';

export const formPrimaryButtonClassName =
	'flex h-12 w-full items-center justify-center rounded-[var(--radius-control)] bg-accent text-sm font-semibold tracking-[0.02em] text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60';

export const formCardClassName =
	'w-full max-w-md rounded-2xl border border-surface-border bg-surface p-6 sm:p-8';
