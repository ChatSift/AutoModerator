import { inject, singleton } from 'tsyringe';
import { Command } from '../../../../command';
import { ArgumentsOf, send } from '#util';
import { FilterCommand } from '#interactions';
import { kSql } from '@automoderator/injection';
import { Rest as DiscordRest } from '@cordis/rest';
import { HTTPError, Rest } from '@automoderator/http-client';
import type { APIGuildInteraction } from 'discord-api-types/v9';
import type { ApiPutGuildsFiltersUrlsBody, ApiDeleteGuildsFiltersUrlsBody, ApiGetGuildsFiltersUrlsResult } from '@automoderator/core';
import type { Sql } from 'postgres';

@singleton()
export class UrlsConfig implements Command {
  public constructor(
    public readonly rest: Rest,
    public readonly discordRest: DiscordRest,
    @inject(kSql) public readonly sql: Sql<{}>
  ) {}

  private handleHttpError(interaction: APIGuildInteraction, error: HTTPError) {
    switch (error.statusCode) {
      case 404: {
        return send(interaction, { content: 'None of the given urls were on the list' });
      }

      default: {
        throw error;
      }
    }
  }

  public async exec(interaction: APIGuildInteraction, args: ArgumentsOf<typeof FilterCommand>['urls']) {
    switch (Object.keys(args)[0] as keyof typeof args) {
      case 'add': {
        await this.rest.put<unknown, ApiPutGuildsFiltersUrlsBody>(
          `/api/v1/guilds/${interaction.guild_id}/filters/urls`,
          args.add.entries
            .split(',')
            .map(entry => entry.replace(/(https?:\/\/)?/g, ''))
        );

        return send(interaction, { content: 'Successfully added the given urls to the filter list' });
      }

      case 'remove': {
        try {
          await this.rest.delete<unknown, ApiDeleteGuildsFiltersUrlsBody>(
            `/api/v1/guilds/${interaction.guild_id}/filters/urls`,
            args.remove.entries.split(',')
          );

          return send(interaction, { content: 'Successfully removed the given urls from the filter list' });
        } catch (error) {
          if (!(error instanceof HTTPError)) {
            throw error;
          }

          return this.handleHttpError(interaction, error);
        }
      }

      case 'list': {
        const urls = await this.rest.get<ApiGetGuildsFiltersUrlsResult>(`/api/v1/guilds/${interaction.guild_id}/filters/urls`);

        if (!urls.length) {
          return send(interaction, { content: 'There is currently nothing on your filter list' });
        }

        const content = urls.map(data => data.url).join('\n');

        return send(interaction, {
          content: 'Here\'s your list',
          files: [{ name: 'urls.txt', content: Buffer.from(content) }]
        });
      }
    }
  }
}