import { ApplicationCommandOptionType } from 'discord-api-types/v9';

export const BanwordCommand = {
  name: 'banword',
  description: 'Allows you to mange your server\'s banned words and pharses',
  default_permission: false,
  options: [
    {
      name: 'add',
      description: 'Adds the given word/phrase to the list of banned words',
      type: ApplicationCommandOptionType.SubCommand,
      options: [
        {
          name: 'entry',
          description: 'The word/phrase to ban',
          type: ApplicationCommandOptionType.String,
          required: true
        },
        {
          name: 'word',
          description: 'Whether or not the banned characters need to be isolated',
          type: ApplicationCommandOptionType.Boolean,
          required: false
        },
        {
          name: 'warn',
          description: 'Whether or not triggering this entry should cause a warning',
          type: ApplicationCommandOptionType.Boolean,
          required: false
        },
        {
          name: 'mute',
          description: 'Whether or not triggering this entry should cause a mute',
          type: ApplicationCommandOptionType.Boolean,
          required: false
        },
        {
          name: 'muteduration',
          description: 'Duration for the mute (in minutes), if you don\'t want it to be permanent',
          type: ApplicationCommandOptionType.Integer,
          required: false
        },
        {
          name: 'ban',
          description: 'Whether or not triggering this entry should cause a ban',
          type: ApplicationCommandOptionType.Boolean,
          required: false
        }
      ]
    },
    {
      name: 'remove',
      description: 'Removes the given word/phrase from the list of banned words',
      type: ApplicationCommandOptionType.SubCommand,
      options: [
        {
          name: 'entry',
          description: 'The words/phrase to remove',
          type: ApplicationCommandOptionType.String,
          required: true
        }
      ]
    },
    {
      name: 'list',
      description: 'Provides the current ban word list',
      type: ApplicationCommandOptionType.SubCommand,
      options: []
    },
    {
      name: 'bulk',
      description: 'Overwrites your entire list with the entries from the link provided',
      type: ApplicationCommandOptionType.SubCommand,
      options: [
        {
          name: 'list',
          description: 'The list to use',
          type: ApplicationCommandOptionType.String,
          required: true
        }
      ]
    }
  ]
} as const;