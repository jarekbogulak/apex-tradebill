import { APEX_BASE_URL, APEX_NETWORK, APEX_API_KEY, APEX_API_SECRET, APEX_API_PASSPHRASE, APEX_L2_KEY, DEFAULT_SYMBOL, DEFAULT_SYMBOL_DASH } from '@env';
import { Platform } from 'react-native';

export function getEnv() {
  const defaultBase = 'https://testnet.omni.apex.exchange/api';
  const isDev = process.env.NODE_ENV !== 'production';
  const isWeb = Platform.OS === 'web';
  const localProxyBase = `http://localhost:${process.env.DEV_PROXY_PORT || '3001'}/api`;

  let base = APEX_BASE_URL;
  if (isDev && isWeb) {
    // In Metro web development, prefer the local dev proxy.
    if (!base) {
      base = localProxyBase;
    } else if (base.replace(/\/$/, '') === '/api') {
      base = localProxyBase;
    }
  } else {
    base = base || defaultBase;
  }

  const resolvedBase = base.replace(/\/$/, '');
  return {
    APEX_BASE_URL: resolvedBase,
    APEX_NETWORK: APEX_NETWORK || 'TESTNET',
    APEX_API_KEY: APEX_API_KEY || '',
    APEX_API_SECRET: APEX_API_SECRET || '',
    APEX_API_PASSPHRASE: APEX_API_PASSPHRASE || '',
    APEX_L2_KEY: APEX_L2_KEY || '',
    DEFAULT_SYMBOL: DEFAULT_SYMBOL || 'BTCUSDT',
    DEFAULT_SYMBOL_DASH: DEFAULT_SYMBOL_DASH || 'BTC-USDT',
  };
}
