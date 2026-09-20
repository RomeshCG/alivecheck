export function calculateUptimePercent(successful: number, total: number): number | null {
  if (total <= 0) {
    return null;
  }

  return Math.round((successful / total) * 10000) / 100;
}

export const UPTIME_WINDOWS_MS = {
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
} as const;
