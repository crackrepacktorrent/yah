import type { ParentProps } from 'solid-js';
import { EmailNavigation } from '~/ui/email-navigation';
import './emails/emails.css';

export default function EmailManagementLayout(props: ParentProps) {
	return (
		<>
			<EmailNavigation />
			{props.children}
		</>
	);
}
