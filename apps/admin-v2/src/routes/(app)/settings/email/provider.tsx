import { defineFileRoute } from '@solidjs/router/fs';
import { createMemo } from 'solid-js';
import { requireEmailSettingsCapability } from '~/features/email-settings/server';

export const route = defineFileRoute('/settings/email/provider', {
	preload: () => void requireEmailSettingsCapability('view'),
});

export default function ProviderEmailSettingsPage() {
	const authorized = createMemo(() => requireEmailSettingsCapability('view'));
	return (
		<section class="email-settings-page">
			{authorized()}
			<header class="page-header"><div><p class="eyebrow">System settings</p><h1>Provider-owned settings</h1><p>These controls belong to Listmonk’s deployment or its private operator UI. YAH validates and preserves every known v6.2 field during its own settings writes.</p></div></header>
			<div class="settings-advanced-grid">
				<section class="settings-card"><h2>Security</h2><p>Listmonk OIDC, CAPTCHA, trusted URLs, and public-page code affect a separate authentication and browser trust boundary.</p></section>
				<section class="settings-card"><h2>Media and custom messengers</h2><p>Filesystem/S3 credentials and arbitrary postback messengers remain deployment-owned until YAH has a product workflow for them.</p></section>
				<section class="settings-card"><h2>Appearance code</h2><p>Custom CSS and JavaScript can execute on recipient pages. They are deliberately excluded from this public admin surface.</p></section>
				<section class="settings-card"><h2>Database and updates</h2><p>Vacuum scheduling and update checks are controlled by the pinned container deployment and PostgreSQL maintenance plan.</p></section>
			</div>
			<section class="settings-card settings-tunnel"><h2>Private Listmonk operator UI</h2><p>Open an SSH tunnel from an authorized operator workstation, then visit <code>http://127.0.0.1:9000</code>:</p><pre><code>ssh -L 9000:localhost:9000 deploy@&lt;direct-vps-host&gt;</code></pre><p>Use the direct target from local SSH configuration or the deployment secret; never the Cloudflare-facing y4h.org hostname.</p><p>If imported or never-saved SMTP, bounce-mailbox, or messenger records have missing or duplicate UUIDs, re-enter their credentials and save them once in this private UI. YAH refuses every full settings write until Listmonk has assigned stable identifiers, preventing one masked credential from being attached to the wrong record.</p></section>
		</section>
	);
}
