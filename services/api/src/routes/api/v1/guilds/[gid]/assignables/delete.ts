import { injectable } from 'tsyringe';
import { Route, thirdPartyAuth } from '@automoderator/rest';
import { AssignablesController } from '#controllers';
import { notFound } from '@hapi/boom';
import type { Request, Response, NextHandler } from 'polka';
import type { Snowflake } from 'discord-api-types/v9';

@injectable()
export default class DeleteGuildsAssignablesRoute extends Route {
  public override readonly middleware = [thirdPartyAuth()];

  public constructor(
    public readonly controller: AssignablesController
  ) {
    super();
  }

  public async handle(req: Request, res: Response, next: NextHandler) {
    const { gid } = req.params as { gid: Snowflake };

    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');

    const assignables = await this.controller.deleteAll(gid);

    if (!assignables.length) {
      return next(notFound('There were no self assignable roles to delete'));
    }

    return res.end(JSON.stringify(assignables));
  }
}