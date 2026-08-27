import { For, Show } from 'solid-js';
import { roleBadgeKind } from './ui-model';
import './membership.css';

export function RoleBadges(props: { roles: readonly string[] }) {
	return (
		<span class="role-badges">
			<Show when={props.roles.length > 0} fallback={<span class="membership-empty">No roles</span>}>
				<For each={props.roles}>
					{(role) => <span class={['role-badge', `role-badge--${roleBadgeKind(role)}`]}>{role}</span>}
				</For>
			</Show>
		</span>
	);
}
