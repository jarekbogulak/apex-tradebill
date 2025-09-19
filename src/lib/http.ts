import axios from 'axios';
import { getEnv } from '@/config/appEnv';
import { apexHeaders } from './apexSign';

export const httpPublic = axios.create({
  baseURL: getEnv().APEX_BASE_URL,
  timeout: 10000,
});

export const httpPrivate = axios.create({
  baseURL: getEnv().APEX_BASE_URL,
  timeout: 15000,
});

httpPrivate.interceptors.request.use(async (config) => {
  // ApeX expects APEX-TIMESTAMP in milliseconds.
  const ts = Date.now().toString();
  const fullUrl = `${config.baseURL || ''}${config.url || ''}`;
  const method = (config.method || 'get').toLowerCase();
  let signingBody: any = null;
  if (method !== 'get' && config.data) {
    if (typeof config.data === 'string') {
      try { signingBody = require('qs').parse(config.data); } catch { signingBody = null; }
    } else if (typeof config.data === 'object') {
      signingBody = config.data as any;
    }
  }
  const headers = await apexHeaders(ts, method, fullUrl, signingBody);
  config.headers = { ...(config.headers || {}), ...headers } as any;
  if (method !== 'get') {
    (config.headers as any)['Content-Type'] = 'application/x-www-form-urlencoded';
  }
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    try { console.log('[httpPrivate] signed', { ts, method, url: fullUrl, signingBody }); } catch {}
  }
  return config;
});
