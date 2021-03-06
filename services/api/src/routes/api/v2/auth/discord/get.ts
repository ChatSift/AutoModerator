import { Config, kConfig } from '@automoderator/injection';
import type { Request, Response } from 'polka';
import { inject, injectable } from 'tsyringe';
import { URLSearchParams } from 'url';
import { Route, validate } from '@chatsift/rest-utils';
import { userAuth } from '#middleware';
import { State } from '#util';
import { GetAuthDiscordQuerySchema, GetAuthDiscordQuery } from '@chatsift/api-wrapper/v2';

@injectable()
export default class extends Route {
	public override readonly middleware = [validate(GetAuthDiscordQuerySchema, 'query'), userAuth(true)];

	public constructor(@inject(kConfig) public readonly config: Config) {
		super();
	}

	public handle(req: Request, res: Response) {
		const { redirect_uri } = req.query as GetAuthDiscordQuery;

		if (req.user) {
			res.redirect(redirect_uri);
			return res.end();
		}

		const state = new State(redirect_uri).toString();

		const params = new URLSearchParams({
			client_id: this.config.discordClientId,
			redirect_uri: `${this.config.apiDomain}/api/v2/auth/discord/callback`,
			response_type: 'code',
			scope: this.config.discordScopes,
			state,
		});

		res.cookie('state', state, { httpOnly: true, path: '/' });
		res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
		return res.end();
	}
}
