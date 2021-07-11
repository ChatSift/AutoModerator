import { inject, injectable } from 'tsyringe';
import { Command } from '../../command';
import { ArgumentsOf } from '#util';
import { send, UserPerms } from '@automoderator/interaction-util';
import { ConfigCommand } from '#interactions';
import { Rest } from '@cordis/rest';
import { APIGuildInteraction } from 'discord-api-types/v8';
import { kSql } from '@automoderator/injection';
import { stripIndents } from 'common-tags';
import type { GuildSettings } from '@automoderator/core';
import type { Sql } from 'postgres';

@injectable()
export default class implements Command {
  public readonly userPermissions = UserPerms.admin;

  public constructor(
    public readonly rest: Rest,
    @inject(kSql) public readonly sql: Sql<{}>
  ) {}

  private _sendCurrentSettings(message: APIGuildInteraction, settings?: Partial<GuildSettings>) {
    const atRole = (role?: string | null) => role ? `<@&${role}>` : 'none';

    return send(message, {
      content: stripIndents`
        **Here are your current settings:**
        • mod role: ${atRole(settings?.mod_role)}
        • mute queue: ${atRole(settings?.mute_role)}
      `,
      allowed_mentions: { parse: [] }
    });
  }

  public parse(args: ArgumentsOf<typeof ConfigCommand>) {
    return {
      modrole: args.modrole,
      muterole: args.muterole
    };
  }

  public async exec(interaction: APIGuildInteraction, args: ArgumentsOf<typeof ConfigCommand>) {
    const { modrole, muterole } = this.parse(args);

    let settings: Partial<GuildSettings> = { guild_id: interaction.guild_id };

    if (modrole) settings.mod_role = modrole.id;
    if (muterole) settings.mute_role = muterole.id;

    if (!Object.values(settings).length) {
      const [currentSettings] = await this.sql<[GuildSettings?]>`SELECT * FROM settings WHERE guild_id = ${interaction.guild_id}`;
      return this._sendCurrentSettings(interaction, currentSettings);
    }

    [settings] = await this.sql`
      INSERT INTO guild_settings ${this.sql(settings)}
      ON CONFLICT (guild_id)
      DO
        UPDATE SET ${this.sql(settings)}
        RETURNING *
    `;

    return this._sendCurrentSettings(interaction, settings);
  }
}
