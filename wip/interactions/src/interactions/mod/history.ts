import { UserPerms } from '@automoderator/discord-permissions';
import { ApplicationCommandOptionType } from 'discord-api-types/v9';

export const HistoryCommand = {
	name: 'history',
	description: 'Pulls up the history of a given user',
	default_permission: false,
	perms: UserPerms.mod,
	options: [
		{
			name: 'user',
			description: 'The user to look up',
			type: ApplicationCommandOptionType.User,
			required: true,
		},
	],
} as const;