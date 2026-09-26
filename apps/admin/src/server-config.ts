import { createFlightDataCollector } from '@solidjs/router/server';
import { configureServerFunctionsServer } from '@solidjs/web/server-functions/server';
import { Router } from '~/router';

configureServerFunctionsServer({
	// Campaigns and templates accept 5 MB of UTF-8 content. JSON can expand a
	// control byte to a six-byte escape; leave room for that plus the command
	// envelope while retaining a finite bound before argument decoding.
	bodySizeLimit: 32_000_000,
	collectFlightData: createFlightDataCollector(Router),
});
