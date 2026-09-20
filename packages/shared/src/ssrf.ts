import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

const blocked = new BlockList();

blocked.addSubnet('0.0.0.0', 8, 'ipv4');
blocked.addSubnet('10.0.0.0', 8, 'ipv4');
blocked.addSubnet('100.64.0.0', 10, 'ipv4');
blocked.addSubnet('127.0.0.0', 8, 'ipv4');
blocked.addSubnet('169.254.0.0', 16, 'ipv4');
blocked.addSubnet('172.16.0.0', 12, 'ipv4');
blocked.addSubnet('192.0.2.0', 24, 'ipv4');
blocked.addSubnet('192.168.0.0', 16, 'ipv4');
blocked.addSubnet('198.18.0.0', 15, 'ipv4');
blocked.addSubnet('198.51.100.0', 24, 'ipv4');
blocked.addSubnet('203.0.113.0', 24, 'ipv4');
blocked.addSubnet('224.0.0.0', 4, 'ipv4');
blocked.addSubnet('240.0.0.0', 4, 'ipv4');

blocked.addAddress('::', 'ipv6');
blocked.addAddress('::1', 'ipv6');
blocked.addSubnet('fc00::', 7, 'ipv6');
blocked.addSubnet('fe80::', 10, 'ipv6');
blocked.addSubnet('ff00::', 8, 'ipv6');
blocked.addSubnet('2001:db8::', 32, 'ipv6');

const blockedHostnames = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata.google',
]);

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfError';
  }
}

function ipv4FromMapped(address: string): string | null {
  const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped?.[1] ?? null;
}

export function isBlockedIp(address: string): boolean {
  const mapped = ipv4FromMapped(address);
  if (mapped) {
    return blocked.check(mapped, 'ipv4');
  }

  const version = isIP(address);
  if (version === 4) {
    return blocked.check(address, 'ipv4');
  }
  if (version === 6) {
    return blocked.check(address, 'ipv6');
  }
  return true;
}

export function parsePublicHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SsrfError('Invalid URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SsrfError('Only HTTP and HTTPS URLs are allowed');
  }

  if (url.username || url.password) {
    throw new SsrfError('URLs with credentials are not allowed');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (blockedHostnames.has(hostname) || hostname.endsWith('.localhost')) {
    throw new SsrfError('This hostname is not allowed');
  }

  if (isIP(hostname) && isBlockedIp(hostname)) {
    throw new SsrfError('Private or reserved IP addresses are not allowed');
  }

  return url;
}

export async function resolvePublicAddress(hostname: string): Promise<{
  address: string;
  family: 4 | 6;
}> {
  if (isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      throw new SsrfError('Private or reserved IP addresses are not allowed');
    }
    return { address: hostname, family: isIP(hostname) === 6 ? 6 : 4 };
  }

  let result: { address: string; family: number };
  try {
    result = await lookup(hostname, { verbatim: true });
  } catch {
    throw new SsrfError('Could not resolve hostname');
  }

  if (isBlockedIp(result.address)) {
    throw new SsrfError('Hostname resolved to a private or reserved address');
  }

  return {
    address: result.address,
    family: result.family === 6 ? 6 : 4,
  };
}

export async function assertSafeHttpUrl(raw: string): Promise<URL> {
  const url = parsePublicHttpUrl(raw);
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  await resolvePublicAddress(hostname);
  return url;
}
