import * as crypto from 'crypto-js';
import qs from 'qs';
import { getEnv } from '@/config/appEnv';

/**
 * Very typical HMAC pattern:
 *   sign = HMAC_SHA256(secret, `${timestamp}${method.toUpperCase()}${path}${bodyString}`)
 * Adjust stringToSign() if ApeX changes format for your account.
 */
function stringToSign(ts: string, method: string, urlPath: string, body: any) {
  const m = method.toUpperCase();
  const path = urlPath.startsWith('http')
    ? new URL(urlPath).pathname + (new URL(urlPath).search || '')
    : urlPath;
  const bodyStr = body ? (typeof body === 'string' ? body : qs.stringify(body)) : '';
  return `${ts}${m}${path}${bodyStr}`;
}

export async function apexHeaders(ts: string, method: string, urlPath: string, body: any) {
  const { APEX_API_KEY, APEX_API_SECRET, APEX_API_PASSPHRASE } = getEnv();
  if (!APEX_API_KEY || !APEX_API_SECRET || !APEX_API_PASSPHRASE) return {} as Record<string, string>;
  const payload = stringToSign(ts, method, urlPath, body);
  const sig = crypto.HmacSHA256(payload, APEX_API_SECRET).toString();
  return {
    'APEX-TIMESTAMP': ts,
    'APEX-API-KEY': APEX_API_KEY,
    'APEX-PASSPHRASE': APEX_API_PASSPHRASE,
    'APEX-SIGNATURE': sig,
  } as Record<string, string>;
}

/** Placeholder for zkLink signature (body "signature" field) */
export function signOrderZk(payloadForL2: string, l2Key?: string) {
  // If you have a JavaScript signer for your zk keys, plug it here.
  // For now we return empty so server can reject if required and we can inspect.
  // In Testnet flows, you can often use get-worst-price + required fields and populate signature via SDK if available.
  return '';
}

