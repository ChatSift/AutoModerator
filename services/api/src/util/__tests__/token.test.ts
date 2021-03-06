import { PrismaClient } from '@prisma/client';
import { compare } from 'bcrypt';
import { randomBytes } from 'crypto';
import { container } from 'tsyringe';
import { TokenManager, TokenValidationStatus } from '../token';

jest.mock('crypto');
jest.mock('bcrypt');

const findFirstMock = jest.fn();
container.register<any>(PrismaClient, {
	useValue: {
		app: {
			findFirst: findFirstMock,
		},
		sig: {
			update: jest.fn(),
			create: jest.fn(),
		},
	},
});

const tokens = container.resolve(TokenManager);

const bytes = Buffer.from('Nw8JLJM+fOIhESzPBHSMzdheBtcAeaELEKtg142yaqg=', 'base64');

const randomBytesMock = randomBytes as unknown as jest.Mock<Buffer, [number]>;
randomBytesMock.mockReturnValue(bytes);

const compareMock = compare as unknown as jest.Mock<Promise<boolean>, [string, string]>;
compareMock.mockImplementation((a, b) => Promise.resolve(a === b));

let token: string;

beforeAll(async () => {
	token = await tokens.generate(1);
	const sigs = [{ sig: token.split('.')[1] }];

	findFirstMock.mockReturnValue({ sigs });
});

test('token generation', () => {
	expect(token).toBe(`${Buffer.from('1').toString('base64')}.${bytes.toString('base64')}`);
});

describe('token validation', () => {
	test('malformed token', async () => {
		expect((await tokens.validate('a.b.c')).status).toBe(TokenValidationStatus.malformedToken);
	});

	test('malformed app id', async () => {
		// Non-int parsable user id
		expect((await tokens.validate(`${Buffer.from('awooga', 'utf8').toString('base64')}.bcdefg`)).status).toBe(
			TokenValidationStatus.malformedAppId,
		);
	});

	test('no sig match', async () => {
		// Adding characters to the signature (end of the token) to prevent a match
		expect((await tokens.validate(`${token}abcdefg`)).status).toBe(TokenValidationStatus.noMatch);
	});

	test('valid token', async () => {
		expect((await tokens.validate(token)).status).toBe(TokenValidationStatus.success);
	});
});
