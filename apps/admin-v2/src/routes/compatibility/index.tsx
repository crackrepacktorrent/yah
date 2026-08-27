import { useSubmissions, type RouteDefinition } from '@solidjs/router';
import { Show, createMemo } from 'solid-js';
import { getCompatibilitySnapshot, runCompatibilityCheck } from '~/lib/compatibility';

export const route = {
	preload: () => void getCompatibilitySnapshot(),
} satisfies RouteDefinition;

export default function CompatibilityLab() {
	const snapshot = createMemo(() => getCompatibilitySnapshot());
	const submissions = useSubmissions(runCompatibilityCheck);
	const latestSubmission = createMemo(() => submissions.at(-1));

	return (
		<main class="shell">
			<p class="eyebrow">Compatibility lab · parallel migration target</p>
			<h1>Solid 2 platform smoke</h1>
			<p>The current admin stays runnable while features move here one vertical slice at a time.</p>
			<dl class="snapshot">
				<div>
					<dt>Rendering</dt>
					<dd>{snapshot().rendering.toUpperCase()}</dd>
				</div>
				<div>
					<dt>Router</dt>
					<dd>{snapshot().router}</dd>
				</div>
				<div>
					<dt>Server functions</dt>
					<dd>{snapshot().serverFunctions ? 'enabled' : 'disabled'}</dd>
				</div>
				<div>
					<dt>Runtime</dt>
					<dd>{snapshot().runtime}</dd>
				</div>
			</dl>
			<form action={runCompatibilityCheck} method="post">
				<label for="check-label">Mutation label</label>
				<div class="form-row">
					<input id="check-label" name="label" value="platform smoke" maxlength="80" required />
					<button type="submit">Run typed mutation</button>
				</div>
			</form>
			<Show when={latestSubmission()?.result}>{(result) => <p role="status">Accepted: {result().label}</p>}</Show>
			<Show when={latestSubmission()?.error}>
				<p role="alert">Mutation rejected by the server contract.</p>
			</Show>
			<p>
				<a href="/api/health">Inspect the API health route</a>
			</p>
			<p>
				<a href="/compatibility/icons">Test the framework-neutral icon renderer</a>
			</p>
			<p>
				<a href="/compatibility/toasts">Test the app-owned toast facade</a>
			</p>
			<p>
				<a href="/compatibility/content">Test Lexical and QR rendering</a>
			</p>
			<p>
				<a href="/compatibility/auth">Test the framework-neutral Better Auth client</a>
			</p>
		</main>
	);
}
