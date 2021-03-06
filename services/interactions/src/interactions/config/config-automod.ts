import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord-api-types/v9';

export const ConfigAutoCommand = {
	name: 'config-automod',
	description: 'Configure automod settings',
	default_member_permissions: String(PermissionFlagsBits.ManageGuild),
	options: [
		{
			name: 'show',
			description: 'Shows the current options',
			type: ApplicationCommandOptionType.Subcommand,
			options: [],
		},
		{
			name: 'set-cooldown',
			description: 'Sets the automod cooldown',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'cooldown',
					description: 'The new automod cooldown to use',
					type: ApplicationCommandOptionType.Number,
					required: true,
				},
			],
		},
		{
			name: 'antispam',
			description: 'Configure antispam options',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'amount',
					description: 'Configure how many messages should trigger a punishment',
					type: ApplicationCommandOptionType.Integer,
					required: false,
				},
				{
					name: 'time',
					description: 'Configure in what interval (seconds) those messages need to be sent for a mute to trigger',
					type: ApplicationCommandOptionType.Integer,
					required: false,
				},
			],
		},
		{
			name: 'mention',
			description: 'Configure settings regarding mentions',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'limit',
					description: 'Max number of mentions per message',
					type: ApplicationCommandOptionType.Integer,
					required: false,
				},
				{
					name: 'amount',
					description: 'How many mentions a user is allowed before triggering a punishment',
					type: ApplicationCommandOptionType.Integer,
					required: false,
				},
				{
					name: 'time',
					description:
						'In what interval the configured amount of mentions needs to be sent for a punishment to trigger',
					type: ApplicationCommandOptionType.Integer,
					required: false,
				},
			],
		},
	],
} as const;
