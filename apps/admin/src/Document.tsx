import { HydrationScript } from '@solidjs/web';
import type { ParentProps } from 'solid-js';
import { env } from 'virtual:env/client';

export default function Document(props: ParentProps) {
	return (
		<html lang="en">
			<head>
				<meta charset="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<meta name="robots" content="noindex, nofollow" />
				<title>{env.VITE_ADMIN_TITLE}</title>
				<HydrationScript />
			</head>
			<body>{props.children}</body>
		</html>
	);
}
