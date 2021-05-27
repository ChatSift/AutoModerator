// A token is structured as {app_id}.{sig}
// Where both of these things are base64 encoded and
// The sig is in plain text.

// A sig is 32 random bytes. It is kept as a bcrypt hash in the database

// On authorizing a request, one should break down the token, use the app_id to gather all the sigs available
// And check if any of them matches the provided one

// Unused sigs are automatically expired after a week.

import { compare, hash } from 'bcrypt';
import { randomBytes } from 'crypto';
import { container } from 'tsyringe';
import { kSql } from '@automoderator/injection';
import type { Sql } from 'postgres';
import type { App, Sig } from '@automoderator/core';

export const enum TokenValidationStatus {
  malformedToken,
  malformedAppId,
  noMatch,
  success
}

export interface TokenValidationResult {
  status: TokenValidationStatus;
  app?: App;
}

export const generateToken = async (id: number): Promise<string> => {
  const sql = container.resolve<Sql<{}>>(kSql);

  const idChunk = Buffer
    .from(id.toString())
    .toString('base64');

  const tokenBytes = randomBytes(32);

  await sql`INSERT INTO sigs (app_id, sig) VALUES (${id}, ${await hash(tokenBytes, 10)})`;
  return `${idChunk}.${tokenBytes.toString('base64')}`;
};

export const validateToken = async (token: string): Promise<TokenValidationResult> => {
  const sql = container.resolve<Sql<{}>>(kSql);

  const meta = token.split('.');
  if (meta.length !== 2) {
    return { status: TokenValidationStatus.malformedToken };
  }

  const [idRaw, sigRaw] = meta as [string, string];
  const id = parseInt(Buffer.from(idRaw, 'base64').toString('utf8'), 10);

  if (isNaN(id)) {
    return { status: TokenValidationStatus.malformedAppId };
  }

  /* istanbul ignore next */
  const { app, sigs = [] } = await sql.begin<{ app?: App; sigs?: Sig[] }>(async sql => {
    const [app] = await sql<[App?]>`SELECT * FROM apps WHERE app_id = ${id}`;

    if (app) {
      return { app, sigs: await sql<Sig[]>`SELECT * FROM sigs WHERE app_id = ${id} ORDER BY last_used_at DESC` };
    }

    return {};
  });

  let match: string | null = null;
  for (const { sig } of sigs) {
    if (await compare(sigRaw, sig)) {
      match = sig;
      break;
    }
  }

  if (!match) {
    return { status: TokenValidationStatus.noMatch };
  }

  await sql`UPDATE sigs SET last_used_at = now() WHERE sig = ${match}`;

  return { status: TokenValidationStatus.success, app };
};
