import { describe, expect, it } from 'vitest';
import { isBlockedIp, parsePublicHttpUrl, SsrfError } from './ssrf.js';
import { applyCheckResult } from './status.js';
import { calculateUptimePercent } from './uptime.js';
import { formatEventSubject } from './notifications.js';

describe('SSRF URL parsing', () => {
  it('allows public https URLs', () => {
    const url = parsePublicHttpUrl('https://example.com/health');
    expect(url.hostname).toBe('example.com');
  });

  it('rejects localhost hostnames', () => {
    expect(() => parsePublicHttpUrl('http://localhost/secret')).toThrow(SsrfError);
  });

  it('rejects loopback IPs', () => {
    expect(() => parsePublicHttpUrl('http://127.0.0.1/')).toThrow(SsrfError);
  });

  it('rejects private IPv4 ranges', () => {
    expect(() => parsePublicHttpUrl('http://10.0.0.5/')).toThrow(SsrfError);
    expect(() => parsePublicHttpUrl('http://192.168.1.10/')).toThrow(SsrfError);
    expect(() => parsePublicHttpUrl('http://172.16.4.1/')).toThrow(SsrfError);
  });

  it('rejects cloud metadata IPs', () => {
    expect(() => parsePublicHttpUrl('http://169.254.169.254/latest/meta-data/')).toThrow(SsrfError);
  });

  it('rejects IPv6 loopback', () => {
    expect(() => parsePublicHttpUrl('http://[::1]/')).toThrow(SsrfError);
  });

  it('rejects non-http schemes', () => {
    expect(() => parsePublicHttpUrl('ftp://example.com/')).toThrow(SsrfError);
    expect(() => parsePublicHttpUrl('file:///etc/passwd')).toThrow(SsrfError);
  });

  it('rejects URLs with credentials', () => {
    expect(() => parsePublicHttpUrl('https://user:pass@example.com/')).toThrow(SsrfError);
  });
});

describe('blocked IPs', () => {
  it('blocks mapped IPv4 loopback', () => {
    expect(isBlockedIp('::ffff:127.0.0.1')).toBe(true);
  });

  it('allows a public address', () => {
    expect(isBlockedIp('1.1.1.1')).toBe(false);
  });
});

describe('status machine', () => {
  const base = {
    currentStatus: 'UP' as const,
    consecutiveFailures: 0,
    consecutiveSuccesses: 2,
    failureThreshold: 3,
    recoveryThreshold: 2,
  };

  it('does not mark DOWN before the failure threshold', () => {
    const first = applyCheckResult(base, false);
    expect(first.currentStatus).toBe('UP');
    expect(first.event).toBeNull();
    const second = applyCheckResult({ ...base, ...first }, false);
    expect(second.currentStatus).toBe('UP');
    const third = applyCheckResult({ ...base, ...second }, false);
    expect(third.currentStatus).toBe('DOWN');
    expect(third.event).toBe('monitor.down');
    expect(third.openedIncident).toBe(true);
  });

  it('requires recovery threshold before sending recovered', () => {
    const down = {
      ...base,
      currentStatus: 'DOWN' as const,
      consecutiveFailures: 3,
      consecutiveSuccesses: 0,
    };
    const first = applyCheckResult(down, true);
    expect(first.currentStatus).toBe('DOWN');
    expect(first.event).toBeNull();
    const second = applyCheckResult({ ...down, ...first }, true);
    expect(second.currentStatus).toBe('UP');
    expect(second.event).toBe('monitor.recovered');
    expect(second.resolvedIncident).toBe(true);
  });

  it('moves NEW to UP on first success', () => {
    const result = applyCheckResult({ ...base, currentStatus: 'NEW', consecutiveSuccesses: 0 }, true);
    expect(result.currentStatus).toBe('UP');
    expect(result.event).toBeNull();
  });
});

describe('uptime', () => {
  it('returns null when there are no checks', () => {
    expect(calculateUptimePercent(0, 0)).toBeNull();
  });

  it('computes a percentage from successful checks', () => {
    expect(calculateUptimePercent(99, 100)).toBe(99);
    expect(calculateUptimePercent(1, 3)).toBe(33.33);
  });
});

describe('notification copy', () => {
  it('formats down and recovered subjects', () => {
    expect(
      formatEventSubject({
        event: 'monitor.down',
        monitor: 'API',
        url: 'https://example.com',
        timestamp: '2026-09-20T06:00:00Z',
      }),
    ).toContain('DOWN');
    expect(
      formatEventSubject({
        event: 'monitor.recovered',
        monitor: 'API',
        url: 'https://example.com',
        timestamp: '2026-09-20T06:00:00Z',
      }),
    ).toContain('RECOVERED');
  });
});
