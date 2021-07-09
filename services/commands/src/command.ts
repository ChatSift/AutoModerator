import { basename, extname } from 'path';
import type { APIGuildInteraction } from 'discord-api-types/v8';
import type { UserPerms } from '@automoderator/interaction-util';
export interface Command {
  name?: string;
  userPermissions?: UserPerms;
  exec(message: APIGuildInteraction, args: unknown): unknown;
}

export interface CommandInfo {
  name: string;
}

export const commandInfo = (path: string): CommandInfo | null => {
  if (extname(path) !== '.js') {
    return null;
  }

  return {
    name: basename(path, '.js')
  };
};
