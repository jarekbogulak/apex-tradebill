import * as crypto from 'crypto-js';
import qs from 'qs';
import { getEnv } from '@/config/appEnv';

/**
 * Very typical HMAC pattern:
 *   sign = HMAC_SHA256(secret, `${timestamp}${method.toUpperCase()}${path}${bodyString}`)
 * Adjust stringToSign() if ApeX changes format for your account.
 */
function buildDataString(body: any): string {
  if (!body) return '';
  if (typeof body === 'string') return body;
  if (typeof body === 'object') {
    const parts = Object.entries(body)
      .filter(([, v]) => v !== undefined && v !== null)
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map(([k, v]) => `${k}=${v}`);
    return parts.join('&');
  }
  return '';
}

function stringToSign(ts: string, method: string, urlPath: string, body: any) {
  const m = method.toUpperCase();
  const url = urlPath.startsWith('http') ? new URL(urlPath) : null;
  const path = url ? url.pathname + (url.search || '') : urlPath;
  const bodyStr = buildDataString(body);
  return `${ts}${m}${path}${bodyStr}`;
}

export async function apexHeaders(ts: string, method: string, urlPath: string, body: any) {
  const { APEX_API_KEY, APEX_API_SECRET, APEX_API_PASSPHRASE } = getEnv();
  if (!APEX_API_KEY || !APEX_API_SECRET || !APEX_API_PASSPHRASE) return {} as Record<string, string>;
  const payload = stringToSign(ts, method, urlPath, body);
  // ApeX requires using base64(secret) as the HMAC key, and base64 output digest
  const keyB64 = crypto.enc.Base64.stringify(crypto.enc.Utf8.parse(APEX_API_SECRET));
  const sigWordArray = crypto.HmacSHA256(payload, crypto.enc.Utf8.parse(keyB64));
  const sig = crypto.enc.Base64.stringify(sigWordArray);
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    try {
      console.log('[apexSign] payloadToSign', payload);
      console.log('[apexSign] keyB64 head', keyB64.slice(0, 12));
      console.log('[apexSign] signature head (b64)', sig.slice(0, 12));
    } catch {}
  }
  return {
    'APEX-TIMESTAMP': ts,
    'APEX-API-KEY': APEX_API_KEY,
    'APEX-PASSPHRASE': APEX_API_PASSPHRASE,
    'APEX-SIGNATURE': sig,
  } as Record<string, string>;
}

/** Placeholder for zkLink signature (body "signature" field) */
export async function signOrderZk(payloadForL2: string, l2Key?: string) {
  // Prefer an external signer service for security. This avoids embedding
  // zk secrets in the mobile/web app.
  try {
    const { APEX_SIGNER_URL } = getEnv() as any;
    if (APEX_SIGNER_URL) {
      const url = `${APEX_SIGNER_URL.replace(/\/$/, '')}/sign-order`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: payloadForL2, l2Key }),
      });
      if (!res.ok) {
        throw new Error(`signer http ${res.status}`);
      }
      const json: any = await res.json();
      const sig = json?.signature || json?.data?.signature;
      if (sig) return sig as string;
    }
  } catch (e) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      try { console.warn('[signOrderZk] signer error', String(e)); } catch {}
    }
  }
  // If no signer configured, return empty (caller decides whether to throw)
  return '';
}
