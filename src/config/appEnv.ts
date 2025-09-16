import { APEX_BASE_URL, APEX_NETWORK, APEX_API_KEY, APEX_API_SECRET, APEX_API_PASSPHRASE, APEX_L2_KEY, DEFAULT_SYMBOL, DEFAULT_SYMBOL_DASH } from '@env';
import { Platform } from 'react-native';

export function getEnv() {
  const defaultBase = 'https://testnet.omni.apex.exchange/api';
  const devWebProxyBase = '/api';
  const isDev = process.env.NODE_ENV !== 'production';
  const isWeb = Platform.OS === 'web';
  const resolvedBase = (APEX_BASE_URL || (isDev && isWeb ? devWebProxyBase : defaultBase)).replace(/\/$/, '');
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
