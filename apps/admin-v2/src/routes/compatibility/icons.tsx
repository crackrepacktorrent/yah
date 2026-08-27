import { For } from 'solid-js';
import { Icon, navIcons, uiIcons, type NavIconName } from '~/ui/icon';

const entries = Object.entries(navIcons) as Array<[NavIconName, (typeof navIcons)[NavIconName]]>;

export default function IconCompatibility() {
	return (
		<main class="shell">
			<p class="eyebrow">Dependency gallery</p>
			<h1>Framework-neutral icons</h1>
			<p>
				<a href="/compatibility">Back to the platform smoke</a>
			</p>
			<ul class="icon-gallery" aria-label="Navigation icons">
				<For each={entries}>
					{(entry) => (
						<li>
							<Icon node={entry[1]} size={18} class="gallery-icon" />
							<span>{entry[0]}</span>
						</li>
					)}
				</For>
			</ul>
			<p>
				<Icon node={uiIcons.lock} size={20} strokeWidth={1.5} label="Locked feature" class="gallery-icon" />
			</p>
		</main>
	);
}
