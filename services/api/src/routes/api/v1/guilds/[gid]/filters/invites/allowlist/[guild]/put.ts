import { InvitesAllowlistController } from '#controllers';
import { Route, thirdPartyAuth } from '@automoderator/rest';
import { conflict } from '@hapi/boom';
import type { Snowflake } from 'discord-api-types/v9';
import type { NextHandler, Request, Response } from 'polka';
import { injectable } from 'tsyringe';

@injectable()
export default class PutGuildsFiltersInvitesAllowlistRoute extends Route {
  public override readonly middleware = [thirdPartyAuth()];

  public constructor(
    public readonly controller: InvitesAllowlistController
  ) {
    super();
  }

  public async handle(req: Request, res: Response, next: NextHandler) {
    const { gid, guild } = req.params as { gid: Snowflake; guild: string };

    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');

    const ignore = await this.controller.add(gid, guild);

    if (!ignore) {
      return next(conflict('That guild is already on the allowlist'));
    }

    return res.end(JSON.stringify(ignore));
  }
}