import type { IncomingMessage, ServerResponse } from 'node:http';
import { sendJson, providerSubscriber, providerBounce, providerCampaign, nextCampaignTimestamp, nextSubscriberTimestamp } from './http';
import { fixtureState } from './state';

export async function handleFixtureControl(request: IncomingMessage, response: ServerResponse, url: URL): Promise<boolean> {
	if (url.pathname === '/health') {
		sendJson(response, { status: 'ok' });
		return true;
	}
	if (url.pathname === '/__control/fail-next' && request.method === 'POST') {
		const provider = url.searchParams.get('provider');
		if (provider === 'shlink') fixtureState.failNextShlinkRequest = true;
		else if (provider === 'listmonk') fixtureState.failNextListmonkRequest = true;
		else if (provider === 'campaign-analytics') fixtureState.failNextCampaignAnalyticsRequest = true;
		else fixtureState.failNextUmamiRequest = true;
		sendJson(response, { armed: true });
		return true;
	}
	if (url.pathname === '/__control/delay-next' && request.method === 'POST') {
		fixtureState.delayNextUmamiRequest = true;
		sendJson(response, { armed: true });
		return true;
	}
	if (url.pathname === '/__control/transactional-messages' && request.method === 'GET') {
		sendJson(response, { messages: fixtureState.transactionalMessages });
		return true;
	}
	if (url.pathname === '/__control/email-settings' && request.method === 'GET') {
		sendJson(response, {
			settings: fixtureState.listmonkSettings,
			smtpTestRequests: fixtureState.smtpTestRequests,
		});
		return true;
	}
	if (url.pathname === '/__control/campaigns' && request.method === 'GET') {
		sendJson(response, {
			campaigns: fixtureState.campaigns.map((campaign) => providerCampaign(campaign)),
		});
		return true;
	}
	if (url.pathname === '/__control/campaign-analytics' && request.method === 'GET') {
		sendJson(response, { requests: fixtureState.campaignAnalyticsRequests });
		return true;
	}
	if (url.pathname === '/__control/campaign-test-sends' && request.method === 'GET') {
		sendJson(response, { requests: fixtureState.campaignTestSendRequests });
		return true;
	}
	if (url.pathname === '/__control/campaign-test-send-outcome' && request.method === 'POST') {
		const outcome = url.searchParams.get('outcome');
		if (outcome !== 'accepted' && outcome !== 'rejected' && outcome !== 'ambiguous') {
			sendJson(response, { message: 'Unknown fixture campaign test-send outcome.' }, 400);
			return true;
		}
		fixtureState.campaignTestSendOutcome = outcome;
		sendJson(response, { outcome });
		return true;
	}
	if (url.pathname === '/__control/touch-campaign' && request.method === 'POST') {
		const campaign = fixtureState.campaigns.find(({ id }) => id === Number(url.searchParams.get('id')));
		if (!campaign) {
			sendJson(response, { message: 'Unknown fixture campaign.' }, 404);
			return true;
		}
		campaign.updatedAt = nextCampaignTimestamp();
		sendJson(response, { touched: campaign.id, updatedAt: campaign.updatedAt });
		return true;
	}
	if (url.pathname === '/__control/campaign-messenger' && request.method === 'POST') {
		const campaign = fixtureState.campaigns.find(({ id }) => id === Number(url.searchParams.get('id')));
		const messenger = url.searchParams.get('messenger');
		if (!campaign || !messenger || !['email', 'email-primary', 'webhook'].includes(messenger)) {
			sendJson(response, { message: 'Unknown fixture campaign messenger target.' }, 400);
			return true;
		}
		campaign.messenger = messenger;
		sendJson(response, { campaignId: campaign.id, messenger });
		return true;
	}
	if (url.pathname === '/__control/subscribers' && request.method === 'GET') {
		sendJson(response, {
			subscribers: [...fixtureState.subscribers].sort((left, right) => right.id - left.id).map(providerSubscriber),
			optInRequests: fixtureState.optInRequests,
		});
		return true;
	}
	if (url.pathname === '/__control/bounces' && request.method === 'GET') {
		sendJson(response, {
			bounces: [...fixtureState.bounces].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).map(providerBounce),
		});
		return true;
	}
	if (url.pathname === '/__control/touch-subscriber' && request.method === 'POST') {
		const subscriber = fixtureState.subscribers.find(({ id }) => id === Number(url.searchParams.get('id')));
		if (!subscriber) {
			sendJson(response, { message: 'Unknown fixture subscriber.' }, 404);
			return true;
		}
		subscriber.updatedAt = nextSubscriberTimestamp();
		sendJson(response, {
			touched: subscriber.id,
			updatedAt: subscriber.updatedAt,
		});
		return true;
	}
	if (url.pathname === '/__control/touch-subscriber-membership' && request.method === 'POST') {
		const subscriber = fixtureState.subscribers.find(({ id }) => id === Number(url.searchParams.get('id')));
		const membership = subscriber?.memberships.find(({ listId }) => listId === Number(url.searchParams.get('listId')));
		if (!subscriber || !membership) {
			sendJson(response, { message: 'Unknown fixture subscriber membership.' }, 404);
			return true;
		}
		membership.updatedAt = nextSubscriberTimestamp();
		sendJson(response, {
			touched: subscriber.id,
			listId: membership.listId,
			membershipUpdatedAt: membership.updatedAt,
		});
		return true;
	}
	if (url.pathname === '/__control/reset' && request.method === 'POST') {
		fixtureState.reset();
		sendJson(response, { reset: true });
		return true;
	}
	return false;
}
