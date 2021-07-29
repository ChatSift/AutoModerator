import { readFileSync } from 'fs';
import { singleton, inject } from 'tsyringe';
import { join as joinPath } from 'path';
import { Rest } from '@automoderator/http-client';
import { kLogger } from '@automoderator/injection';
import type { ApiPostGuildsFiltersUrlsBody, ApiPostGuildsFiltersUrlsResult } from '@automoderator/core';
import type { Logger } from 'pino';

@singleton()
export class UrlsRunner {
  public readonly urlRegex = /([^\.\s\/]+\.)+(?<tld>[^\.\s\/]+)(?<url>\/[^\s]*)?/gm;
  public readonly tlds: Set<string>;

  public constructor(
    public readonly rest: Rest,
    @inject(kLogger) public readonly logger: Logger
  ) {
    const contents = readFileSync(joinPath(__dirname, '..', '..', 'tlds.txt'), 'utf8');
    this.tlds = contents
      .split('\n')
      .reduce((acc, line) => {
        if (!line.startsWith('#') && line.length) {
          acc.add(line.toLowerCase());
        }

        return acc;
      }, new Set<string>());

    logger.debug({ tlds: [...this.tlds] }, 'Successfully computed valid tlds');
  }

  public precheck(content: string): string[] {
    const urls = [...content.matchAll(this.urlRegex)].reduce<Set<string>>((acc, match) => {
      if (this.tlds.has(match.groups!.tld!.toLowerCase())) {
        acc.add(match[0]!);
      }

      return acc;
    }, new Set());

    return [...urls];
  }

  public run(urls: string[], guildId: string, guildOnly: boolean) {
    return this.rest.post<ApiPostGuildsFiltersUrlsResult, ApiPostGuildsFiltersUrlsBody>(`/guilds/${guildId}/filters/urls`, {
      urls,
      guild_only: guildOnly
    });
  }
}
