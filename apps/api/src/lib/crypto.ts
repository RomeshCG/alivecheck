import { encryptJson, decryptJson, maskSecret } from '@alivecheck/shared';
import { env } from './env.js';

export function encryptConfig(value: unknown): string {
  return encryptJson(env.encryptionKey, value);
}

export function decryptConfig<T>(payload: string): T {
  return decryptJson<T>(env.encryptionKey, payload);
}

export { maskSecret };
