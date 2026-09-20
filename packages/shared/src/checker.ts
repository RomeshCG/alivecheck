import { Agent, fetch } from 'undici';
import { isIP } from 'node:net';
import { assertSafeHttpUrl, parsePublicHttpUrl, resolvePublicAddress, SsrfError } from './ssrf.js';

export type CheckErrorType =
  | 'TIMEOUT'
  | 'DNS'
  | 'CONNECTION'
  | 'TLS'
  | 'HTTP_STATUS'
  | 'TOO_LARGE'
  | 'SSRF'
  | 'UNKNOWN';

export type CheckRequest = {
  url: string;
  method: 'GET' | 'HEAD';
  timeoutSeconds: number;
  expectedStatus: number;
  userAgent?: string;
};

export type CheckResult = {
  success: boolean;
  statusCode: number | null;
  responseTimeMs: number;
  errorType: CheckErrorType | null;
  responseSize: number | null;
};

const MAX_REDIRECTS = 3;
const MAX_RESPONSE_BYTES = 1024 * 1024;

type HopResult = {
  status: number;
  size: number;
  redirectTo: string | null;
};

function classifyError(error: unknown): CheckErrorType {
  if (error instanceof SsrfError) {
    return 'SSRF';
  }

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  const name = error instanceof Error ? error.name : '';

  if (name === 'TimeoutError' || message.includes('timeout') || message.includes('aborted')) {
    return 'TIMEOUT';
  }
  if (message.includes('enotfound') || message.includes('getaddrinfo') || message.includes('resolve')) {
    return 'DNS';
  }
  if (message.includes('cert') || message.includes('ssl') || message.includes('tls')) {
    return 'TLS';
  }
  if (
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('enetunreach') ||
    message.includes('ehostunreach')
  ) {
    return 'CONNECTION';
  }
  return 'UNKNOWN';
}

async function pinnedFetch(
  url: URL,
  method: 'GET' | 'HEAD',
  timeoutMs: number,
  userAgent: string,
): Promise<HopResult> {
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const resolved = await resolvePublicAddress(hostname);

  const dispatcher = new Agent({
    connectTimeout: timeoutMs,
    connect: {
      servername: isIP(hostname) ? undefined : hostname,
      lookup(_host, options, callback) {
        const cb = typeof options === 'function' ? options : callback;
        if (typeof options === 'object' && options?.all) {
          cb(null, [{ address: resolved.address, family: resolved.family }]);
          return;
        }
        cb(null, resolved.address, resolved.family);
      },
    },
  });

  const response = await fetch(url, {
    method,
    dispatcher,
    redirect: 'manual',
    headers: {
      'user-agent': userAgent,
      accept: '*/*',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  const location = response.headers.get('location');
  const sizeHeader = response.headers.get('content-length');
  if (sizeHeader && Number(sizeHeader) > MAX_RESPONSE_BYTES) {
    response.body?.cancel();
    throw Object.assign(new Error('Response too large'), { code: 'TOO_LARGE' });
  }

  let size = 0;
  if (response.body && method === 'GET') {
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw Object.assign(new Error('Response too large'), { code: 'TOO_LARGE' });
      }
    }
  } else {
    response.body?.cancel();
    size = sizeHeader ? Number(sizeHeader) : 0;
  }

  const redirected = response.status >= 300 && response.status < 400 && Boolean(location);
  return {
    status: response.status,
    size,
    redirectTo: redirected ? location : null,
  };
}

async function followSafeRedirects(
  start: URL,
  method: 'GET' | 'HEAD',
  timeoutMs: number,
  userAgent: string,
): Promise<{ status: number; size: number }> {
  let current = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const result = await pinnedFetch(current, hop === 0 ? method : 'GET', timeoutMs, userAgent);
    if (!result.redirectTo) {
      return { status: result.status, size: result.size };
    }
    if (hop === MAX_REDIRECTS) {
      throw new SsrfError('Too many redirects');
    }
    const next = new URL(result.redirectTo, current);
    await assertSafeHttpUrl(next.toString());
    current = parsePublicHttpUrl(next.toString());
  }
  throw new SsrfError('Too many redirects');
}

export async function performHttpCheck(request: CheckRequest): Promise<CheckResult> {
  const started = Date.now();
  const userAgent = request.userAgent ?? 'AliveCheck/1.0';
  const timeoutMs = request.timeoutSeconds * 1000;

  try {
    const url = await assertSafeHttpUrl(request.url);
    const { status, size } = await followSafeRedirects(url, request.method, timeoutMs, userAgent);
    const responseTimeMs = Date.now() - started;
    const success = status === request.expectedStatus;

    return {
      success,
      statusCode: status,
      responseTimeMs,
      errorType: success ? null : 'HTTP_STATUS',
      responseSize: size,
    };
  } catch (error) {
    const responseTimeMs = Date.now() - started;
    const code = (error as { code?: string }).code;
    if (process.env.ALIVECHECK_DEBUG_CHECKS === 'true') {
      console.error('HTTP check failed:', error);
    }
    return {
      success: false,
      statusCode: null,
      responseTimeMs,
      errorType: code === 'TOO_LARGE' ? 'TOO_LARGE' : classifyError(error),
      responseSize: null,
    };
  }
}
