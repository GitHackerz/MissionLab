import 'server-only';
import type { TokenType } from '@prisma/client';
import { prisma } from '@/server/db';
import { generateToken, hashToken } from './crypto';

const TTL_MS: Record<TokenType, number> = {
  EMAIL_VERIFY: 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 60 * 60 * 1000,
};

/** Issues a fresh one-time token and invalidates older unused ones of the same type. */
export async function issueToken(userId: string, type: TokenType): Promise<string> {
  const token = generateToken();
  await prisma.$transaction([
    prisma.authToken.deleteMany({ where: { userId, type, usedAt: null } }),
    prisma.authToken.create({
      data: { tokenHash: hashToken(token), type, userId, expiresAt: new Date(Date.now() + TTL_MS[type]) },
    }),
  ]);
  return token;
}

/** Marks a valid token as used and returns its user id, or null if invalid/expired/used. */
export async function consumeToken(token: string, type: TokenType): Promise<string | null> {
  const record = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.type !== type || record.usedAt || record.expiresAt < new Date()) return null;

  // updateMany with usedAt: null makes consumption atomic if the link is clicked twice.
  const { count } = await prisma.authToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  return count === 1 ? record.userId : null;
}
