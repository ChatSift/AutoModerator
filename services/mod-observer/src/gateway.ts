import {
  ApiPostGuildsCasesBody,
  ApiPostGuildsCasesResult,
  Case,
  CaseAction,
  DiscordEvents,
  GuildSettings,
  Log,
  LogTypes
} from '@automoderator/core';
import { DiscordPermissions } from '@automoderator/discord-permissions';
import { Rest } from '@automoderator/http-client';
import { Config, kConfig, kLogger, kSql } from '@automoderator/injection';
import { createAmqp, PubSubPublisher, RoutingSubscriber } from '@cordis/brokers';
import { Store } from '@cordis/store';
import { RedisStore } from '@cordis/redis-store';
import { Rest as CordisRest } from '@cordis/rest';
import { getCreationData } from '@cordis/util';
import {
  APIGuildMember,
  APIRole,
  APIUser,
  AuditLogEvent,
  GatewayDispatchEvents,
  GatewayGuildBanModifyDispatchData,
  GatewayGuildMemberAddDispatchData,
  GatewayGuildMemberRemoveDispatchData,
  GatewayGuildMemberUpdateDispatchData,
  RESTGetAPIAuditLogQuery,
  RESTGetAPIAuditLogResult,
  RESTPatchAPIGuildMemberJSONBody,
  Routes,
  Snowflake
} from 'discord-api-types/v9';
import type { Logger } from 'pino';
import type { Sql } from 'postgres';
import Redis from 'ioredis';
import { inject, singleton } from 'tsyringe';

@singleton()
export class Gateway {
  private readonly _redis = new Redis(this.config.redisUrl);

  private readonly _guildPermsCache = new Store<DiscordPermissions>({ emptyEvery: 15e3 });
  private readonly _guildMembersCache = new RedisStore<APIGuildMember & { user: APIUser }>({
    hash: 'guild_members_cache',
    redis: this._redis,
    encode: member => JSON.stringify(member),
    decode: member => JSON.parse(member)
  });

  public guildLogs!: PubSubPublisher<Log>;

  public constructor(
    @inject(kConfig) public readonly config: Config,
    @inject(kSql) public readonly sql: Sql<{}>,
    @inject(kLogger) public readonly logger: Logger,
    public readonly rest: Rest,
    public readonly discord: CordisRest
  ) {}

  private async getPerms(guildId: Snowflake): Promise<DiscordPermissions> {
    if (this._guildPermsCache.has(guildId)) {
      return this._guildPermsCache.get(guildId)!;
    }

    const guildMe = await this.discord.get<APIGuildMember>(Routes.guildMember(guildId, this.config.discordClientId)).catch(() => null);
    const roles = await this.discord.get<APIRole[]>(Routes.guildRoles(guildId))
      .then(
        roles => new Map(
          roles.map(role => [role.id, role])
        )
      )
      .catch(() => null);

    if (!guildMe || !roles) {
      this.logger.warn('Something went wrong getting the guild member object or the guild roles - returning no perms');
      return new DiscordPermissions(0n);
    }

    const perms = guildMe.roles.reduce<DiscordPermissions>(
      (acc, role) => acc.add(BigInt(roles.get(role)!.permissions)),
      new DiscordPermissions(0n)
    );

    this._guildPermsCache.set(guildId, perms);

    return perms;
  }

  private async hasAuditLog(guildId: Snowflake): Promise<boolean> {
    const perms = await this.getPerms(guildId);
    return perms.has('viewAuditLog');
  }

  private async handleGuildBanAdd(data: GatewayGuildBanModifyDispatchData) {
    const [settings] = await this.sql<[GuildSettings?]>`SELECT * FROM guild_settings WHERE guild_id = ${data.guild_id}`;

    if (!settings?.mod_action_log_channel) {
      return null;
    }

    const [cs] = await this.rest.post<ApiPostGuildsCasesResult, ApiPostGuildsCasesBody>(`/guilds/${data.guild_id}/cases`, [{
      action: CaseAction.ban,
      target_id: data.user.id,
      target_tag: `${data.user.username}#${data.user.discriminator}`,
      created_at: new Date()
    }]);

    this.guildLogs.publish({
      type: LogTypes.modAction,
      data: cs!
    });
  }

  private async handleGuildBanRemove(data: GatewayGuildBanModifyDispatchData) {
    const [settings] = await this.sql<[GuildSettings?]>`SELECT * FROM guild_settings WHERE guild_id = ${data.guild_id}`;

    if (!settings?.mod_action_log_channel) {
      return null;
    }

    const [cs] = await this.rest.post<ApiPostGuildsCasesResult, ApiPostGuildsCasesBody>(`/guilds/${data.guild_id}/cases`, [{
      action: CaseAction.unban,
      target_id: data.user.id,
      target_tag: `${data.user.username}#${data.user.discriminator}`,
      created_at: new Date()
    }]);

    this.guildLogs.publish({
      type: LogTypes.modAction,
      data: cs!
    });
  }

  private async handleGuildMemberRemove(data: GatewayGuildMemberRemoveDispatchData) {
    const [settings] = await this.sql<[GuildSettings?]>`SELECT * FROM guild_settings WHERE guild_id = ${data.guild_id}`;

    if (!settings?.mod_action_log_channel || !await this.hasAuditLog(data.guild_id)) {
      return null;
    }

    const fetchedLog = await this.discord.get<RESTGetAPIAuditLogResult, RESTGetAPIAuditLogQuery>(Routes.guildAuditLog(data.guild_id), {
      query: {
        action_type: AuditLogEvent.MemberKick,
        limit: 1
      }
    });

    const [entry] = fetchedLog.audit_log_entries;
    if (
      !entry ||
      entry.target_id !== data.user.id ||
      (Date.now() - getCreationData(entry.id).createdAt.getTime()) >= 3e4
    ) {
      return null;
    }

    const [cs] = await this.rest.post<ApiPostGuildsCasesResult, ApiPostGuildsCasesBody>(`/guilds/${data.guild_id}/cases`, [{
      action: CaseAction.kick,
      target_id: data.user.id,
      target_tag: `${data.user.username}#${data.user.discriminator}`,
      created_at: new Date()
    }]);

    this.guildLogs.publish({
      type: LogTypes.modAction,
      data: cs!
    });
  }

  private async handleExistingMute(data: GatewayGuildMemberAddDispatchData) {
    const [settings] = await this.sql<[GuildSettings?]>`SELECT * FROM guild_settings WHERE guild_id = ${data.guild_id}`;

    const [existingMuteCase] = await this.sql<[Case?]>`
      SELECT * FROM cases
      WHERE target_id = ${data.user!.id}
        AND action_type = ${CaseAction.mute}
        AND guild_id = ${data.guild_id}
        AND processed = false
    `;

    if (!settings?.mute_role || !existingMuteCase) {
      return null;
    }

    await this.discord.patch<unknown, RESTPatchAPIGuildMemberJSONBody>(Routes.guildMember(data.guild_id, data.user!.id), {
      data: { roles: [settings.mute_role] },
      reason: 'User is muted but rejoined the server'
    }).catch(() => null);
  }

  private async handleJoinAge(data: GatewayGuildMemberAddDispatchData) {
    const [settings] = await this.sql<[GuildSettings?]>`SELECT * FROM guild_settings WHERE guild_id = ${data.guild_id}`;

    if (settings?.min_join_age == null || data.user!.bot) {
      return null;
    }

    if (Date.now() - getCreationData(data.user!.id).createdAt.getTime() >= settings.min_join_age) {
      return null;
    }

    await this.discord.delete(Routes.guildMember(data.guild_id, data.user!.id), {
      reason: 'Join age violation'
    }).catch(() => null);
  }

  private async handleBlankAvatar(data: GatewayGuildMemberAddDispatchData) {
    const [settings] = await this.sql<[GuildSettings?]>`SELECT * FROM guild_settings WHERE guild_id = ${data.guild_id}`;

    if (!settings?.no_blank_avatar || data.user!.bot) {
      return null;
    }

    if (data.user!.avatar) {
      return null;
    }

    await this.discord.delete(Routes.guildMember(data.guild_id, data.user!.id), {
      reason: 'Blank avatar violation'
    }).catch(() => null);
  }

  private async handleGuildMemberUpdate(o: APIGuildMember & { user: APIUser }, n: GatewayGuildMemberUpdateDispatchData) {

  }

  public async init() {
    const { channel } = await createAmqp(this.config.amqpUrl);
    const gateway = new RoutingSubscriber<keyof DiscordEvents, DiscordEvents>(channel);
    const logs = new PubSubPublisher(channel);

    await logs.init({ name: 'guild_logs', fanout: false });

    this.guildLogs = logs;

    gateway
      .on(GatewayDispatchEvents.GuildBanAdd, data => void this.handleGuildBanAdd(data))
      .on(GatewayDispatchEvents.GuildBanRemove, data => void this.handleGuildBanRemove(data))
      .on(GatewayDispatchEvents.GuildMemberRemove, data => void this.handleGuildMemberRemove(data))
      .on(GatewayDispatchEvents.GuildMemberAdd, data => {
        void this.handleExistingMute(data);
        void this.handleJoinAge(data);
        void this.handleBlankAvatar(data);
      })
      .on(GatewayDispatchEvents.GuildMemberUpdate, async data => {
        const cachedOld = await this._guildMembersCache.get(data.user.id);

        if (cachedOld) {
          return this.handleGuildMemberUpdate(cachedOld, data);
        }
      });

    await gateway.init({
      name: 'gateway',
      keys: [
        GatewayDispatchEvents.GuildBanAdd,
        GatewayDispatchEvents.GuildBanRemove,
        GatewayDispatchEvents.GuildMemberRemove,
        GatewayDispatchEvents.GuildMemberAdd,
        GatewayDispatchEvents.GuildMemberUpdate
      ],
      queue: 'mod_observer'
    });

    return gateway;
  }
}
