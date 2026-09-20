import { Prisma, prisma, runMonitorCheck } from '@alivecheck/db';
import { workerEnv } from './env.js';

const BATCH_SIZE = 10;
const TICK_MS = 5000;
const RETENTION_DAYS = 30;
const RETENTION_EVERY_MS = 60 * 60 * 1000;

async function claimDueMonitors(): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id
      FROM "Monitor"
      WHERE enabled = true
        AND (
          "lastCheckedAt" IS NULL
          OR "lastCheckedAt" + ("intervalSeconds" * interval '1 second') <= NOW()
        )
      ORDER BY "lastCheckedAt" ASC NULLS FIRST
      LIMIT ${Prisma.raw(String(BATCH_SIZE))}
      FOR UPDATE SKIP LOCKED
    `;

    if (rows.length === 0) {
      return [];
    }

    const ids = rows.map((row) => row.id);
    await tx.monitor.updateMany({
      where: { id: { in: ids } },
      data: { lastCheckedAt: new Date() },
    });
    return ids;
  });
}

async function tick(): Promise<void> {
  const ids = await claimDueMonitors();
  for (const id of ids) {
    try {
      await runMonitorCheck({
        monitorId: id,
        encryptionKey: workerEnv.encryptionKey,
        userAgent: workerEnv.checkerUserAgent,
        updateSchedule: false,
      });
    } catch (error) {
      console.error(`Check failed for ${id}:`, error);
    }
  }
}

async function retain(): Promise<void> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const deleted = await prisma.monitorCheck.deleteMany({
    where: { checkedAt: { lt: cutoff } },
  });
  if (deleted.count > 0) {
    console.log(`Retention removed ${deleted.count} old checks`);
  }
}

async function main() {
  console.log('AliveCheck worker started');
  await retain().catch((error) => console.error('Retention failed:', error));

  setInterval(() => {
    tick().catch((error) => console.error('Worker tick failed:', error));
  }, TICK_MS);

  setInterval(() => {
    retain().catch((error) => console.error('Retention failed:', error));
  }, RETENTION_EVERY_MS);

  await tick();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
