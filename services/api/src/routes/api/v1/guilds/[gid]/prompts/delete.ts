import { PromptsController } from '#controllers';
import { Route } from '@chatsift/rest-utils';
import { notFound } from '@hapi/boom';
import type { Snowflake } from 'discord-api-types/v9';
import type { NextHandler, Request, Response } from 'polka';
import { injectable } from 'tsyringe';
import { thirdPartyAuth } from '#middleware';

@injectable()
export default class extends Route {
	public override readonly middleware = [thirdPartyAuth()];

	public constructor(public readonly controller: PromptsController) {
		super();
	}

	public async handle(req: Request, res: Response, next: NextHandler) {
		const { gid } = req.params as { gid: Snowflake };

		res.statusCode = 200;
		res.setHeader('content-type', 'application/json');

		const prompts = await this.controller.deleteAll(gid);

		if (!prompts.length) {
			return next(notFound('There were no prompts to delete'));
		}

		return res.end(JSON.stringify(prompts));
	}
}
