import session from 'express-session';
import type { SessionData } from 'express-session';
import { prisma } from '@alivecheck/db';
import { env } from './env.js';

type Callback = (err?: unknown, result?: SessionData | null) => void;

export class PrismaSessionStore extends session.Store {
  async get(sid: string, callback: Callback): Promise<void> {
    try {
      const row = await prisma.session.findUnique({ where: { sid } });
      if (!row || row.expiresAt.getTime() < Date.now()) {
        if (row) {
          await prisma.session.delete({ where: { sid } }).catch(() => undefined);
        }
        callback(undefined, null);
        return;
      }
      callback(undefined, JSON.parse(row.data) as SessionData);
    } catch (error) {
      callback(error);
    }
  }

  async set(sid: string, sess: SessionData, callback: (err?: unknown) => void): Promise<void> {
    try {
      const expiresAt = sess.cookie.expires
        ? new Date(sess.cookie.expires)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const userId = (sess as SessionData & { userId?: string }).userId ?? null;
      await prisma.session.upsert({
        where: { sid },
        create: { sid, data: JSON.stringify(sess), expiresAt, userId },
        update: { data: JSON.stringify(sess), expiresAt, userId },
      });
      callback();
    } catch (error) {
      callback(error);
    }
  }

  async destroy(sid: string, callback: (err?: unknown) => void): Promise<void> {
    try {
      await prisma.session.delete({ where: { sid } }).catch(() => undefined);
      callback();
    } catch (error) {
      callback(error);
    }
  }

  async touch(sid: string, sess: SessionData, callback: (err?: unknown) => void): Promise<void> {
    try {
      const expiresAt = sess.cookie.expires
        ? new Date(sess.cookie.expires)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await prisma.session.update({
        where: { sid },
        data: { expiresAt },
      }).catch(() => undefined);
      callback();
    } catch (error) {
      callback(error);
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

export const sessionMiddleware = session({
  name: 'alivecheck.sid',
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: new PrismaSessionStore(),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  },
});
