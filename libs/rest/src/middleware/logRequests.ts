/* istanbul ignore file */

import { container } from 'tsyringe';
import { kLogger } from '@automoderator/injection';
import { Stopwatch } from '@sapphire/stopwatch';
import type { Logger } from 'pino';
import type { Request, Response, NextHandler } from 'polka';

export const logRequests = () => {
  const logger = container.resolve<Logger>(kLogger);
  return (req: Request, res: Response, next: NextHandler) => {
    const stopwatch = new Stopwatch();

    res.once('close', () => logger.metric!({
      type: 'api_request',
      time: stopwatch.stop().digits,
      method: req.method,
      route: req.originalUrl,
      status: res.statusCode,
      statusText: res.statusMessage,
      body: req.body,
      params: req.params,
      query: req.query
    }, 'API request came through'));

    return next();
  };
};
