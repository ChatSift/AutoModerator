import 'reflect-metadata';

import { container } from 'tsyringe';
import { Rest as DiscordRest, buildRestRouter as buildDiscordRestRouter, IRouter } from '@cordis/rest';
import postgres, { Sql } from 'postgres';
import { kLogger, kSql, kDiscordRest, initConfig } from '@automoderator/injection';
import createLogger from '@automoderator/logger';
import { Gateway } from './gateway';
import * as runners from './runners';
import { Rest, kRest, buildRestRouter } from '@automoderator/http-client';
import type { Logger } from 'pino';

void (async () => {
  const config = initConfig();

  container.register(kRest, { useValue: container.resolve(Rest) });
  buildRestRouter();

  const discordRest = new DiscordRest(config.discordToken);

  const logger = createLogger('AUTOMOD');

  const sql = postgres(config.dbUrl, {
    onnotice: notice => logger.debug({ topic: 'DB NOTICE', notice })
  });

  discordRest
    .on('response', async (req, res, rl) => {
      if (!res.ok) {
        logger.warn({
          topic: 'REQUEST FAILURE',
          res: await res.json(),
          rl
        }, `Failed request ${req.method!} ${req.path!}`);
      }
    })
    .on('ratelimit', (bucket, endpoint, prevented, waitingFor) => {
      logger.warn({
        topic: 'RATELIMIT',
        bucket,
        prevented,
        waitingFor
      }, `Hit a ratelimit on ${endpoint}`);
    });

  if (config.nodeEnv === 'dev') {
    discordRest.on('request', req => logger.trace({ topic: 'REQUEST START' }, `Making request ${req.method!} ${req.path!}`));
  }

  container.register<IRouter>(kDiscordRest, { useValue: buildDiscordRestRouter(discordRest) });
  container.register<Sql<{}>>(kSql, { useValue: sql });
  container.register<Logger>(kLogger, { useValue: logger });
  for (const runner of Object.values(runners)) {
    // @ts-expect-error - tsyringe typings are screwed
    container.register(runner, { useClass: runner });
  }

  await container.resolve(Gateway).init();
  logger.info({ topic: 'AUTOMOD INIT' }, 'Ready to listen to message packets');
})();
