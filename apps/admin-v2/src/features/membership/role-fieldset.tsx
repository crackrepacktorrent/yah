import { For, Show, createUniqueId } from 'solid-js';
import type { RoleOption } from './ui-model';
import './membership.css';

export function RoleFieldset(props: {
	options: readonly RoleOption[];
	selected: readonly string[];
	onChange: (roles: string[]) => void;
	disabled?: boolean;
}) {
	const descriptionId = `${createUniqueId()}-description`;

	function setChecked(role: string, checked: boolean): void {
		props.onChange(
			checked ? [...new Set([...props.selected, role])] : props.selected.filter((selectedRole) => selectedRole !== role),
		);
	}

	return (
		<fieldset class="role-fieldset" aria-describedby={descriptionId} disabled={props.disabled}>
			<legend>Roles</legend>
			<p id={descriptionId}>Permissions from every selected role are combined. Select at least one role.</p>
			<div class="role-option-grid">
				<For each={props.options}>
					{(option) => (
						<label class="role-option" data-missing={option.missing ? '' : undefined}>
							<input
								type="checkbox"
								name="roles"
								value={option.key}
								checked={props.selected.includes(option.key)}
								onChange={(event) => setChecked(option.key, event.currentTarget.checked)}
							/>
							<span>{option.label}</span>
						</label>
					)}
				</For>
			</div>
			<Show when={props.selected.length === 0}>
				<p class="role-fieldset__error" role="alert">Choose at least one role.</p>
			</Show>
		</fieldset>
	);
}
