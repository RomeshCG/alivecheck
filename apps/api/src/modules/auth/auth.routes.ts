import { prisma } from '@alivecheck/db';
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
} from '@alivecheck/shared';
import { Router } from 'express';
import argon2 from 'argon2';
import rateLimit from 'express-rate-limit';
import { asyncHandler, HttpError, requireAuth } from '../../middleware/error.js';

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again later.' },
});

authRouter.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      throw new HttpError(409, 'An account with this email already exists');
    }

    const passwordHash = await argon2.hash(body.password, { type: argon2.argon2id });
    const user = await prisma.user.create({
      data: { email: body.email, passwordHash },
      select: { id: true, email: true, createdAt: true },
    });

    req.session.userId = user.id;
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });
    res.status(201).json({ user });
  }),
);

authRouter.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) {
      throw new HttpError(401, 'Invalid email or password');
    }

    const ok = await argon2.verify(user.passwordHash, body.password);
    if (!ok) {
      throw new HttpError(401, 'Invalid email or password');
    }

    req.session.userId = user.id;
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });
    res.json({
      user: { id: user.id, email: user.email, createdAt: user.createdAt },
    });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await new Promise<void>((resolve, reject) => {
      req.session.destroy((err) => (err ? reject(err) : resolve()));
    });
    res.clearCookie('alivecheck.sid');
    res.json({ ok: true });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      select: { id: true, email: true, createdAt: true },
    });
    if (!user) {
      throw new HttpError(401, 'Authentication required');
    }
    res.json({ user });
  }),
);

authRouter.patch(
  '/password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = changePasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
    if (!user) {
      throw new HttpError(401, 'Authentication required');
    }
    const ok = await argon2.verify(user.passwordHash, body.currentPassword);
    if (!ok) {
      throw new HttpError(400, 'Current password is incorrect');
    }
    const passwordHash = await argon2.hash(body.newPassword, { type: argon2.argon2id });
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      prisma.session.deleteMany({ where: { userId: user.id } }),
    ]);
    req.session.userId = user.id;
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });
    res.json({ ok: true });
  }),
);

authRouter.delete(
  '/account',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    await prisma.user.delete({ where: { id: userId } });
    await new Promise<void>((resolve, reject) => {
      req.session.destroy((err) => (err ? reject(err) : resolve()));
    });
    res.clearCookie('alivecheck.sid');
    res.json({ ok: true });
  }),
);
