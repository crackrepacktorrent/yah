import type { ParentProps } from 'solid-js';
import './auth.css';

export function AuthShell(props: ParentProps<{ logoHeight?: number }>) {
	return (
		<main class="auth-page">
			<div class="auth-container">
				<img class="auth-logo" src="/logo.svg" alt="" height={props.logoHeight ?? 140} />
				{props.children}
			</div>
		</main>
	);
}

export function AuthCard(props: ParentProps<{ centered?: boolean }>) {
	return <section class={{ 'auth-card': true, 'auth-card--centered': !!props.centered }}>{props.children}</section>;
}

export function AuthField(props: ParentProps<{ label: string; required?: boolean }>) {
	return (
		<label class="auth-field">
			<span>
				{props.label}
				{props.required ? <span class="auth-required"> *</span> : null}
			</span>
			{props.children}
		</label>
	);
}

export function AuthError(props: ParentProps) {
	return (
		<p class="auth-error" role="alert">
			{props.children}
		</p>
	);
}
