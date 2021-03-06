import 'reflect-metadata';
import { Rest } from '@chatsift/api-wrapper/v2';
import { initConfig, kLogger, kRedis } from '@automoderator/injection';
import createLogger from '@automoderator/logger';
import { createAmqp, PubSubPublisher, RoutingSubscriber } from '@cordis/brokers';
import { ProxyBucket, Rest as DiscordRest } from '@cordis/rest';
import { readdirRecurse } from '@chatsift/readdir';
import { join as joinPath } from 'path';
import { container, InjectionToken } from 'tsyringe';
import { Handler } from '#handler';
import { kGatewayBroadcasts } from './util';
import type { DiscordEvents } from '@automoderator/broker-types';
import { GatewayDispatchEvents } from 'discord-api-types/v9';
import Redis from 'ioredis';
import { Route } from '@chatsift/rest-utils';
import polka from 'polka';
import { PrismaClient } from '@prisma/client';

void (async () => {
	const config = initConfig();
	const logger = createLogger('interactions');

	const discordRest = new DiscordRest(config.discordToken, {
		bucket: ProxyBucket,
		domain: config.discordProxyUrl,
		retries: 1,
		abortAfter: 20e3,
	}).on('abort', (req) => {
		logger.warn({ req }, `Aborted request ${req.method!} ${req.path!}`);
	});

	const { channel } = await createAmqp(config.amqpUrl);
	const logs = new PubSubPublisher(channel);
	const gateway = new RoutingSubscriber<keyof DiscordEvents, DiscordEvents>(channel);
	const gatewayBroadcasts = new PubSubPublisher(channel);

	await logs.init({ name: 'guild_logs', fanout: false });
	// No queue specified means these packets are fanned out
	await gateway.init({
		name: 'gateway',
		keys: [GatewayDispatchEvents.GuildMembersChunk],
	});
	await gatewayBroadcasts.init({ name: 'gateway_broadcasts', fanout: true });

	container.register(PubSubPublisher, { useValue: logs });
	container.register(RoutingSubscriber, { useValue: gateway });
	container.register(kGatewayBroadcasts, { useValue: gatewayBroadcasts });
	container.register(Rest, { useValue: new Rest(config.apiDomain, config.internalApiToken) });
	container.register(DiscordRest, { useValue: discordRest });
	container.register(kLogger, { useValue: logger });
	container.register(kRedis, { useValue: new Redis(config.redisUrl) });
	container.register(PrismaClient, { useValue: new PrismaClient() });

	await container.resolve(Handler).init();

	const app = polka();
	const files = readdirRecurse(joinPath(__dirname, 'routes'), { fileExtensions: ['js'] });

	for await (const file of files) {
		const info = Route.pathToRouteInfo(file.split('/routes').pop()!);
		if (!info) {
			logger.debug(`Hit path with no info: "${file}"`);
			continue;
		}

		const route = container.resolve<Route>(((await import(file)) as { default: InjectionToken<Route> }).default);
		route.register(info, app);
	}

	app.listen(3002, () => logger.info('Listening for interactions on port 3002'));
})();
