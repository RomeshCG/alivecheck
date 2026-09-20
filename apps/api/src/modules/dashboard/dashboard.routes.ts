import { prisma } from '@alivecheck/db';
import { Router } from 'express';
import { asyncHandler, requireAuth } from '../../middleware/error.js';

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const monitors = await prisma.monitor.findMany({
      where: { userId: req.session.userId },
      orderBy: { name: 'asc' },
    });

    const up = monitors.filter((m) => m.currentStatus === 'UP' || m.currentStatus === 'RECOVERED').length;
    const down = monitors.filter((m) => m.currentStatus === 'DOWN').length;
    const pending = monitors.filter((m) => m.currentStatus === 'NEW').length;

    res.json({
      total: monitors.length,
      up,
      down,
      pending,
      operational: down === 0 && monitors.length > 0,
      monitors,
    });
  }),
);
