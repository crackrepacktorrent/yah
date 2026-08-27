import { can, type PermissionSession } from './can';
import type { PermissionAction, PermissionResource } from './permissions';

export type PermissionRequirement = {
	[Resource in PermissionResource]: readonly [resource: Resource, action: PermissionAction<Resource>];
}[PermissionResource];

type FeaturePolicy =
	| { mode: 'all'; permissions: readonly PermissionRequirement[] }
	| { mode: 'any'; permissions: readonly PermissionRequirement[] };

/**
 * UI feature policies mirror the permissions required by their server queries.
 * Cross-resource requirements belong here so navigation and controls do not
 * advertise a feature that cannot complete its required data loading.
 */
export const featurePolicies = {
	dashboard: {
		mode: 'any',
		permissions: [
			['shortlink', 'view'],
			['analytics', 'view'],
		],
	},
	shortlinks: { mode: 'all', permissions: [['shortlink', 'view']] },
	analytics: { mode: 'all', permissions: [['analytics', 'view']] },
	campaigns: { mode: 'all', permissions: [['campaign', 'view']] },
	campaignAnalytics: { mode: 'all', permissions: [['campaign', 'view']] },
	campaignCreate: {
		mode: 'all',
		permissions: [
			['campaign', 'create'],
			['list', 'view'],
		],
	},
	campaignEdit: {
		mode: 'all',
		permissions: [
			['campaign', 'edit'],
			['list', 'view'],
		],
	},
	templates: { mode: 'all', permissions: [['template', 'view']] },
	templateSetDefault: { mode: 'all', permissions: [['template', 'set-default']] },
	subscribers: { mode: 'all', permissions: [['subscriber', 'view']] },
	subscriberCreate: { mode: 'all', permissions: [['subscriber', 'create']] },
	subscriberEdit: { mode: 'all', permissions: [['subscriber', 'edit']] },
	subscriberSelect: {
		mode: 'any',
		permissions: [
			['subscriber', 'delete'],
			['subscriber', 'blocklist'],
		],
	},
	bounces: { mode: 'all', permissions: [['bounce', 'view']] },
	lists: { mode: 'all', permissions: [['list', 'view']] },
	listEdit: { mode: 'all', permissions: [['list', 'edit']] },
	forms: { mode: 'all', permissions: [['list', 'view']] },
	emailLogs: { mode: 'all', permissions: [['settings', 'view']] },
	members: {
		mode: 'all',
		permissions: [
			['member', 'create'],
			['invitation', 'create'],
		],
	},
	roles: { mode: 'all', permissions: [['ac', 'read']] },
	settings: { mode: 'all', permissions: [['settings', 'view']] },
} as const satisfies Record<string, FeaturePolicy>;

export type Feature = keyof typeof featurePolicies;

export function canAccessFeature(session: PermissionSession | null | undefined, feature: Feature): boolean {
	const policy: FeaturePolicy = featurePolicies[feature];
	const matches = ([resource, action]: PermissionRequirement) => can(session, resource, action);

	return policy.mode === 'all' ? policy.permissions.every(matches) : policy.permissions.some(matches);
}
