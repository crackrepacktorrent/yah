import { For, Show, createSignal, untrack } from 'solid-js';
import type { CustomRolePermissions } from './contracts';

type PermissionStatements = Record<string, readonly string[]>;

const resourceLabels: Record<string, string> = {
	organization: 'Organization',
	member: 'Members',
	invitation: 'Invitations',
	team: 'Teams',
	ac: 'Roles and permissions',
	shortlink: 'Shortlinks',
	template: 'Email templates',
	subscriber: 'Subscribers',
	list: 'Mailing lists',
	bounce: 'Bounces',
	campaign: 'Campaigns',
	analytics: 'Analytics',
	settings: 'Settings',
	provider: 'Email provider operations',
};

export function resourceLabel(resource: string): string {
	return resourceLabels[resource] ?? resource.replaceAll('-', ' ');
}

export function actionLabel(action: string): string {
	return action.replaceAll('-', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

export function permissionResourceCount(permissions: Record<string, readonly string[]>): number {
	return Object.values(permissions).filter((actions) => actions.length > 0).length;
}

export function RoleForm(props: {
	mode: 'create' | 'edit';
	initialKey?: string;
	initialPermissions?: CustomRolePermissions;
	statements: PermissionStatements;
	pending: boolean;
	error: string;
	cancelHref: string;
	onSubmit: (value: { key: string; permissions: CustomRolePermissions }) => void;
}) {
	const initialKey = untrack(() => props.initialKey);
	const initialPermissions = untrack(() => props.initialPermissions);
	const [key, setKey] = createSignal(initialKey ?? '');
	const [permissions, setPermissions] = createSignal<CustomRolePermissions>(
		structuredClone(initialPermissions ?? {}),
	);

	function toggle(resource: string, action: string): void {
		setPermissions((current) => {
			const selected = current[resource as keyof CustomRolePermissions] ?? [];
			const next = selected.includes(action as never)
				? selected.filter((candidate) => candidate !== action)
				: [...selected, action];
			const updated = { ...current } as Record<string, string[]>;
			if (next.length === 0) delete updated[resource];
			else updated[resource] = next;
			return updated as CustomRolePermissions;
		});
	}

	function toggleResource(resource: string, actions: readonly string[]): void {
		setPermissions((current) => {
			const selected = current[resource as keyof CustomRolePermissions] ?? [];
			const updated = { ...current } as Record<string, string[]>;
			if (actions.every((action) => selected.includes(action as never))) delete updated[resource];
			else updated[resource] = [...actions];
			return updated as CustomRolePermissions;
		});
	}

	return (
		<form
			class="role-form"
			onSubmit={(event) => {
				event.preventDefault();
				props.onSubmit({ key: key(), permissions: permissions() });
			}}
		>
			<label class="form-field role-key-field">
				<span>Role key</span>
				<input
					name="key"
					value={key()}
					onInput={(event) => setKey(event.currentTarget.value)}
					disabled={props.mode === 'edit' || props.pending}
					required
					maxlength="128"
					aria-describedby="role-key-help"
				/>
				<small id="role-key-help">
					{props.mode === 'edit'
						? 'Role keys are permanent.'
						: 'Stored in lowercase. Use a stable, comma-free identifier such as content-editor.'}
				</small>
			</label>

			<div class="permission-groups">
				<For each={Object.entries(props.statements)}>
					{([resource, actions]) => {
						const selected = () => permissions()[resource as keyof CustomRolePermissions] ?? [];
						const allSelected = () => actions.every((action) => selected().includes(action as never));
						return (
							<fieldset>
								<legend>{resourceLabel(resource)}</legend>
								<label class="permission-toggle permission-toggle--all">
									<input
										type="checkbox"
										checked={allSelected()}
										onChange={() => toggleResource(resource, actions)}
										disabled={props.pending}
									/>
									<span>All {resourceLabel(resource).toLowerCase()} permissions</span>
								</label>
								<div class="permission-actions">
									<For each={actions}>
										{(action) => (
											<label class="permission-toggle">
												<input
													type="checkbox"
													checked={selected().includes(action as never)}
													onChange={() => toggle(resource, action)}
													disabled={props.pending}
												/>
												<span>{actionLabel(action)}</span>
											</label>
										)}
									</For>
								</div>
							</fieldset>
						);
					}}
				</For>
			</div>

			<Show when={props.error}>
				{(message) => <p class="field-error" role="alert">{message()}</p>}
			</Show>
			<div class="form-actions">
				<a class="button button--secondary" href={props.cancelHref}>Cancel</a>
				<button class="button" type="submit" disabled={props.pending || key().trim() === ''} aria-busy={props.pending ? 'true' : undefined}>
					{props.pending ? 'Saving…' : props.mode === 'create' ? 'Create role' : 'Save permissions'}
				</button>
			</div>
		</form>
	);
}

export function RolePermissionDetails(props: { permissions: Record<string, readonly string[]> }) {
	const entries = () => Object.entries(props.permissions).filter(([, actions]) => actions.length > 0);
	return (
		<Show when={entries().length > 0} fallback={<p>This role grants no permissions.</p>}>
			<dl class="permission-details">
				<For each={entries()}>
					{([resource, actions]) => (
						<div>
							<dt>{resourceLabel(resource)}</dt>
							<dd>{actions.map(actionLabel).join(', ')}</dd>
						</div>
					)}
				</For>
			</dl>
		</Show>
	);
}
