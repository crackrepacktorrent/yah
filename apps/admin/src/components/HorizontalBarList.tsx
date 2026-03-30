import { For, Show } from 'solid-js';
import './HorizontalBarList.css';

type HorizontalBarListProps = {
	items: { label: string; value: number }[];
	color?: string;
	emptyLabel?: string;
	emptyMessage?: string;
};

export function HorizontalBarList(props: HorizontalBarListProps) {
	const max = () => Math.max(...props.items.map((i) => i.value), 1);

	return (
		<Show when={props.items.length > 0} fallback={
			<div class="hbar-empty">{props.emptyMessage ?? 'No data yet.'}</div>
		}>
			<div class="hbar-list">
				<For each={props.items}>
					{(item) => {
						const label = () => item.label || props.emptyLabel || 'Unknown';
						return (
							<div class="hbar-row">
								<span class="hbar-label" title={label()}>{label()}</span>
								<div class="hbar-track">
									<div
										class="hbar-fill"
										style={{
											width: `${(item.value / max()) * 100}%`,
											'background-color': props.color ?? 'var(--brand-olive)',
										}}
									/>
								</div>
								<span class="hbar-value">{item.value}</span>
							</div>
						);
					}}
				</For>
			</div>
		</Show>
	);
}
