import type { Interaction } from '#util';
import { basename, extname } from 'path';

export interface Component {
	name?: string;
	exec: (message: Interaction, args: any) => unknown | Promise<unknown>;
}

export interface ComponentInfo {
	name: string;
}

export function componentInfo(path: string): ComponentInfo | null {
	if (extname(path) !== '.js') {
		return null;
	}

	return {
		name: basename(path, '.js'),
	};
}
