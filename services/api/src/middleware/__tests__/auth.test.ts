/* eslint-disable @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-unsafe-member-access */

import { Boom } from '@hapi/boom';
import { PrismaClient } from '@prisma/client';
import { Http2ServerResponse } from 'http2';
import fetch from 'node-fetch';
import type { Request, Response } from 'polka';
import { container } from 'tsyringe';
import { userAuth } from '../userAuth';

container.register<any>(PrismaClient, {
	useValue: {
		user: {
			findFirst: jest.fn(() => ({ perms: 0n })),
		},
	},
});

jest.mock('http2');

jest.mock('node-fetch', () =>
	jest.fn((_: string, data: { headers: { authorization: string } }) =>
		data.headers.authorization === 'Bearer good'
			? {
					ok: true,
					json: () => Promise.resolve({ id: '123' }),
			  }
			: {
					ok: false,
			  },
	),
);

const mockedFetch = fetch as unknown as jest.Mock<typeof fetch>;
const makeMockedRequest = (data: any) => ({ params: {}, ...data } as Request);
const MockedResponse = Http2ServerResponse as unknown as jest.Mock<Response>;
const mockedNext = jest.fn();

afterEach(() => jest.clearAllMocks());

test('missing token', async () => {
	const authenticator = userAuth(false);

	await authenticator(makeMockedRequest({ headers: {} }), new MockedResponse(), mockedNext);
	expect(mockedFetch).not.toHaveBeenCalled();
	expect(mockedNext).toHaveBeenCalled();
	expect(mockedNext.mock.calls[0][0]).toBeInstanceOf(Boom);
});

test('bad token', async () => {
	const authenticator = userAuth();

	await authenticator(makeMockedRequest({ headers: { authorization: 'bad' } }), new MockedResponse(), mockedNext);
	expect(mockedFetch).toHaveBeenCalled();
	expect(mockedNext).toHaveBeenCalled();
	expect(mockedNext.mock.calls[0][0]).toBeInstanceOf(Boom);
});

test('good token', async () => {
	const authenticator = userAuth();

	const req = makeMockedRequest({ headers: { authorization: 'good' } });

	await authenticator(req, new MockedResponse(), mockedNext);
	expect(mockedFetch).toHaveBeenCalled();
	expect(req.user).toStrictEqual({ id: '123', perms: 0n });
	expect(mockedNext).toHaveBeenCalledWith(undefined);
});

test('fallthrough', async () => {
	const authenticator = userAuth(true);

	await authenticator(makeMockedRequest({ headers: {} }), new MockedResponse(), mockedNext);
	expect(mockedFetch).not.toHaveBeenCalled();
	expect(mockedNext).toHaveBeenCalledWith(undefined);
});
