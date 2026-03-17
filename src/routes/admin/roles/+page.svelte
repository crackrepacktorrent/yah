<script lang="ts">
	import { Badge } from '$lib/components/admin';
	import { getSession } from '../session.remote';

	let role = $derived(getSession().current?.role);

	type Permission = {
		feature: string;
		action: string;
		owner: boolean;
		admin: boolean;
		member: boolean;
	};

	const permissions: Permission[] = [
		// Shortlinks
		{ feature: 'Shortlinks', action: 'View / List', owner: true, admin: true, member: false },
		{ feature: 'Shortlinks', action: 'Create / Edit', owner: true, admin: true, member: false },
		{ feature: 'Shortlinks', action: 'Delete', owner: true, admin: false, member: false },

		// Email Templates
		{ feature: 'Email Templates', action: 'View / List', owner: true, admin: true, member: false },
		{ feature: 'Email Templates', action: 'Create / Edit / Set Default', owner: true, admin: false, member: false },
		{ feature: 'Email Templates', action: 'Delete', owner: true, admin: false, member: false },

		// Subscribers
		{ feature: 'Subscribers', action: 'View / List', owner: true, admin: true, member: false },
		{ feature: 'Subscribers', action: 'Create / Edit', owner: true, admin: true, member: false },
		{ feature: 'Subscribers', action: 'Delete / Blocklist', owner: true, admin: false, member: false },

		// Mailing Lists
		{ feature: 'Mailing Lists', action: 'View / List', owner: true, admin: true, member: false },
		{ feature: 'Mailing Lists', action: 'Create / Edit', owner: true, admin: true, member: false },
		{ feature: 'Mailing Lists', action: 'Delete', owner: true, admin: false, member: false },

		// Bounces
		{ feature: 'Bounces', action: 'View / List', owner: true, admin: true, member: false },
		{ feature: 'Bounces', action: 'Delete / Clear All', owner: true, admin: false, member: false },

		// Members
		{ feature: 'Members', action: 'View / Manage', owner: true, admin: false, member: false },

		// Analytics
		{ feature: 'Analytics', action: 'View', owner: true, admin: true, member: false },
	];

	// Group permissions by feature for row-spanning display
	const featureGroups = $derived.by(() => {
		const groups: { feature: string; rows: Permission[] }[] = [];
		let current: { feature: string; rows: Permission[] } | null = null;
		for (const p of permissions) {
			if (!current || current.feature !== p.feature) {
				current = { feature: p.feature, rows: [] };
				groups.push(current);
			}
			current.rows.push(p);
		}
		return groups;
	});
</script>

<div class="header">
	<h1>Role Permissions</h1>
</div>

<p class="description">
	Overview of what each role can access across the admin panel. This page is read-only.
</p>

<div class="table-wrap">
	<table>
		<thead>
			<tr>
				<th class="col-feature">Feature</th>
				<th class="col-action">Action</th>
				<th class="col-role">
					<Badge variant="warning">Owner</Badge>
				</th>
				<th class="col-role">
					<Badge variant="info">Admin</Badge>
				</th>
				<th class="col-role">
					<Badge variant="default">Member</Badge>
				</th>
			</tr>
		</thead>
		<tbody>
			{#each featureGroups as group}
				{#each group.rows as row, i}
					<tr class:group-start={i === 0}>
						{#if i === 0}
							<td class="feature-cell" rowspan={group.rows.length}>
								{group.feature}
							</td>
						{/if}
						<td class="action-cell">{row.action}</td>
						<td class="perm-cell">
							{#if row.owner}
								<span class="perm-yes" aria-label="Allowed">&#10003;</span>
							{:else}
								<span class="perm-no" aria-label="Not allowed">&mdash;</span>
							{/if}
						</td>
						<td class="perm-cell">
							{#if row.admin}
								<span class="perm-yes" aria-label="Allowed">&#10003;</span>
							{:else}
								<span class="perm-no" aria-label="Not allowed">&mdash;</span>
							{/if}
						</td>
						<td class="perm-cell">
							{#if row.member}
								<span class="perm-yes" aria-label="Allowed">&#10003;</span>
							{:else}
								<span class="perm-no" aria-label="Not allowed">&mdash;</span>
							{/if}
						</td>
					</tr>
				{/each}
			{/each}
		</tbody>
	</table>
</div>

<style>
	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	h1 {
		margin: 0;
		color: var(--color-foreground);
	}

	.description {
		color: var(--color-muted);
		font-size: 0.9rem;
		margin: 0 0 1.5rem;
	}

	.table-wrap {
		overflow-x: auto;
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sm);
		border: 1px solid var(--color-border);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		background: var(--color-surface);
	}

	thead {
		background: var(--color-table-header, var(--color-hover));
	}

	th {
		padding: 0.75rem 1rem;
		text-align: left;
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--color-muted);
		border-bottom: 1px solid var(--color-border);
	}

	th.col-role {
		text-align: center;
		width: 100px;
	}

	td {
		padding: 0.6rem 1rem;
		font-size: 0.9rem;
		color: var(--color-foreground);
		border-bottom: 1px solid var(--color-border);
	}

	tbody tr:last-child td {
		border-bottom: none;
	}

	tr.group-start td {
		border-top: 2px solid var(--color-border);
	}

	thead + tbody tr:first-child td,
	thead + tbody tr.group-start:first-child td {
		border-top: none;
	}

	.feature-cell {
		font-weight: 600;
		vertical-align: top;
		white-space: nowrap;
		background: color-mix(in srgb, var(--color-hover) 50%, transparent);
	}

	.action-cell {
		color: var(--color-muted);
		font-size: 0.85rem;
	}

	.perm-cell {
		text-align: center;
		font-size: 1rem;
	}

	.perm-yes {
		color: var(--color-success, var(--brand-olive));
		font-weight: 700;
		font-size: 1.1rem;
	}

	.perm-no {
		color: var(--color-muted);
		font-size: 1rem;
	}

	@media (max-width: 600px) {
		th, td {
			padding: 0.5rem 0.6rem;
			font-size: 0.8rem;
		}

		th.col-role {
			width: 60px;
		}
	}
</style>
