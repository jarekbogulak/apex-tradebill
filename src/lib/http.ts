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
  const ts = Date.now().toString();
  const headers = await apexHeaders(ts, config.method || 'get', config.url || '', config.data);
  config.headers = { ...(config.headers || {}), ...headers } as any;
  (config.headers as any)['Content-Type'] = 'application/x-www-form-urlencoded';
  return config;
});

