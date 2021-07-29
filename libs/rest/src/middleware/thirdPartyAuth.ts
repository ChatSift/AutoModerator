import { unauthorized, badRequest } from '@hapi/boom';
import { Permissions, TokenManager, TokenValidationStatus } from '../utils';
import { container } from 'tsyringe';
import { kSql } from '@automoderator/injection';
import type { Request, Response, NextHandler } from 'polka';
import type { App, AppGuild } from '@automoderator/core';
import type { Sql } from 'postgres';

declare module 'polka' {
  export interface Request {
    app?: App;
  }
}

export const thirdPartyAuth = (fallthrough = false, guild = true) => {
  const tokens = container.resolve(TokenManager);
  const sql = container.resolve<Sql<{}>>(kSql);

  return async (req: Request, _: Response, next: NextHandler) => {
    const { authorization } = req.headers;

    if (!authorization) {
      return next(fallthrough ? undefined : unauthorized('missing authorization header'));
    }

    if (!authorization.startsWith('App ')) {
      return next(unauthorized('invalid authorization header. please provide an application token'));
    }

    const { status, app } = await tokens.validate(authorization.replace('App ', ''));
    switch (status) {
      case TokenValidationStatus.malformedToken: return next(badRequest('malformed authorization token'));
      case TokenValidationStatus.malformedAppId: return next(badRequest('malformed app id'));
      case TokenValidationStatus.noMatch: return next(fallthrough ? undefined : unauthorized('invalid access token'));
      case TokenValidationStatus.success: {
        req.app = app;
        break;
      }
    }

    if (guild && req.params.gid && !new Permissions(BigInt(req.app!.perms)).has('administrator')) {
      const [guild] = await sql<[AppGuild?]>`SELECT * FROM app_guilds WHERE app_id = ${app!.app_id} AND guild_id = ${req.params.gid}`;
      if (!guild) {
        return next(unauthorized('cannot perform actions on this guild'));
      }
    }

    return next();
  };
};
