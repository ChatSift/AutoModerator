import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord-api-types/v9';

export const UnbanCommand = {
	name: 'unban',
	description: 'Unbans a member',
	default_member_permissions: String(PermissionFlagsBits.BanMembers),
	options: [
		{
			name: 'user',
			description: 'The user to action',
			type: ApplicationCommandOptionType.User,
			required: true,
		},
		{
			name: 'reason',
			description: 'The reason of this action',
			type: ApplicationCommandOptionType.String,
		},
	],
} as const;
