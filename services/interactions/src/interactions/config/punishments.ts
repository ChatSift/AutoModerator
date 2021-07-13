import { ApplicationCommandOptionType } from 'discord-api-types/v8';
import { WarnPunishmentAction } from '@automoderator/core';

export const PunishmentsCommand = {
  name: 'punishments',
  description: 'Manage things related to warn punishments',
  options: [
    {
      name: 'add',
      description: 'Creates a new warn punishment',
      type: ApplicationCommandOptionType.SubCommand,
      options: [
        {
          name: 'count',
          description: 'How many warns are needed to trigger this punishment',
          type: ApplicationCommandOptionType.Integer,
          required: true
        },
        {
          name: 'punishment',
          description: 'The punishment to apply',
          type: ApplicationCommandOptionType.Integer,
          required: true,
          choices: [
            { name: 'mute', value: WarnPunishmentAction.mute },
            { name: 'ban', value: WarnPunishmentAction.ban },
            { name: 'kick', value: WarnPunishmentAction.kick }
          ]
        },
        {
          name: 'duration',
          description: 'Duration of the action (in minutes)',
          type: ApplicationCommandOptionType.Integer
        }
      ]
    },
    {
      name: 'delete',
      description: 'Deletes a warn punishment',
      type: ApplicationCommandOptionType.SubCommand,
      options: [
        {
          name: 'count',
          description: 'How many warns were being used to trigger this action',
          type: ApplicationCommandOptionType.Integer,
          required: true
        }
      ]
    },
    {
      name: 'list',
      description: 'Lists all the existing warn punishments',
      type: ApplicationCommandOptionType.SubCommand,
      options: []
    }
  ]
} as const;