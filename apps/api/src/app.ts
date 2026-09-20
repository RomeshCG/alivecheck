import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './lib/env.js';
import { sessionMiddleware } from './lib/session.js';
import { errorMiddleware } from './middleware/error.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { monitorsRouter } from './modules/monitors/monitors.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin: env.frontendUrl,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());
  app.use(sessionMiddleware);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'alivecheck-api' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/monitors', monitorsRouter);
  app.use('/api/notification-providers', notificationsRouter);
  app.use('/api/dashboard', dashboardRouter);

  app.use(errorMiddleware);
  return app;
}
