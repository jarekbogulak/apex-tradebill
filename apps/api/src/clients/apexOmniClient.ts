import type { MarketSnapshot, Symbol, Timeframe } from '@apex-tradebill/types';
import {
  ApexClient,
  OmniENV,
  OMNI_PROD,
  OMNI_QA,
} from 'apexomni-connector-node';
import {
  PUBLIC_WSS,
  PRIVATE_WSS,
  WS_PROD,
  WS_QA,
} from 'apexomni-connector-node/lib/omni/Constant.js';
import { WSClient } from 'apexomni-connector-node/lib/ws/WSClient.js';
import { calculateAtr } from '../services/calculations/atrCalculator.js';
import type { MarketCandle } from '../domain/ports/tradebillPorts.js';

export interface ApeXOmniClientConfig {
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
  environment?: 'prod' | 'qa';
  restBaseUrl?: string;
  restNetworkId?: number;
  wsBaseUrl?: string;
  wsHeartbeatIntervalMs?: number;
  wsMaxReconnectAttempts?: number;
  defaultAtrMultiplier?: string;
}

export interface MarketStreamConnectOptions {
  symbols: Symbol[];
  onOpen?: () => void;
  onMessage?: (payload: unknown) => void;
  onError?: (error: unknown) => void;
  onClose?: (code: number, reason: Buffer) => void;
}

export interface MarketStreamConnection {
  close(): void;
}

export interface ApeXOmniClient {
  getMarketSnapshot(symbol: Symbol): Promise<MarketSnapshot | null>;
  getRecentCandles(
    symbol: Symbol,
    timeframe: Timeframe,
    limit: number,
  ): Promise<MarketCandle[]>;
  connectMarketStream(options: MarketStreamConnectOptions): MarketStreamConnection;
}

interface OmniDepth {
  a?: Array<[string, string]> | string[][];
  b?: Array<[string, string]> | string[][];
}

interface OmniKline {
  t: number | string;
  h: string;
  l: string;
  c: string;
}

interface OmniTicker {
  symbol: string;
  lastPrice: string;
}

type OmniInterval =
  | '1'
  | '5'
  | '15'
  | '30'
  | '60'
  | '120'
  | '240'
  | '360'
  | '720'
  | 'D'
  | 'M'
  | 'W';

const ATR_PERIOD = 13;
const DEFAULT_ATR_MULTIPLIER = '1.50';
const DEFAULT_KLINE_LOOKBACK = 64;

const TIMEFRAME_INTERVALS: Record<Timeframe, OmniInterval> = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '30m': '30',
  '1h': '60',
  '4h': '240',
};

const sanitizeUrl = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }
  return value.replace(/\/+$/, '');
};

const toApiSymbol = (symbol: Symbol): string => {
  return symbol.replace('-', '');
};

const toPriceString = (value: number): string => {
  return value.toFixed(8);
};

const extractBestPrice = (
  levels?: Array<[string, string]> | string[][],
): string | null => {
  if (!levels || levels.length === 0) {
    return null;
  }
  return levels[0]?.[0] ?? null;
};

const convertKlinesToCandles = (klines: OmniKline[]): MarketCandle[] => {
  return klines
    .map((entry) => {
      const timestampMs = Number(entry.t);
      return {
        timestamp: Number.isFinite(timestampMs)
          ? new Date(timestampMs).toISOString()
          : new Date().toISOString(),
        high: Number.parseFloat(entry.h),
        low: Number.parseFloat(entry.l),
        close: Number.parseFloat(entry.c),
      };
    })
    .filter(
      (candle) =>
        Number.isFinite(candle.high) &&
        Number.isFinite(candle.low) &&
        Number.isFinite(candle.close),
    );
};

const computeAtr = (candles: MarketCandle[], period: number): string => {
  if (candles.length < period) {
    return '0.00000000';
  }
  try {
    const result = calculateAtr(candles, period);
    return toPriceString(result.value);
  } catch {
    return '0.00000000';
  }
};

const createEnv = (
  environment: 'prod' | 'qa',
  restBaseUrl?: string,
  restNetworkId?: number,
): OmniENV => {
  if (restBaseUrl) {
    const sanitized = sanitizeUrl(restBaseUrl) ?? restBaseUrl;
    const networkId =
      restNetworkId ?? (environment === 'qa' ? OMNI_QA.networkId : OMNI_PROD.networkId);
    return new OmniENV(sanitized, networkId);
  }
  return environment === 'qa' ? OMNI_QA : OMNI_PROD;
};

export const createApeXOmniClient = ({
  apiKey,
  apiSecret,
  passphrase,
  environment = 'prod',
  restBaseUrl,
  restNetworkId,
  wsBaseUrl,
  wsHeartbeatIntervalMs,
  wsMaxReconnectAttempts,
  defaultAtrMultiplier = DEFAULT_ATR_MULTIPLIER,
}: ApeXOmniClientConfig): ApeXOmniClient => {
  const resolvedEnv = createEnv(environment, restBaseUrl, restNetworkId);
  const omniClient = ApexClient.createOmniClient(resolvedEnv);
  const endpoint = sanitizeUrl(wsBaseUrl) ?? (resolvedEnv.isProd ? WS_PROD : WS_QA);
  const publicWsUrl = `${endpoint}${PUBLIC_WSS}`;
  const privateWsUrl = `${endpoint}${PRIVATE_WSS}`;

  const fetchKlines = async (
    symbol: Symbol,
    interval: OmniInterval,
    limit: number,
  ): Promise<MarketCandle[]> => {
    const apiSymbol = toApiSymbol(symbol);
    const response = await omniClient.publicApi.klines(
      apiSymbol,
      interval,
      undefined,
      undefined,
      limit,
    );
    const raw = ((response as unknown) as Record<string, OmniKline[]>)[apiSymbol] ?? [];
    return convertKlinesToCandles(raw);
  };

  const getMarketSnapshot = async (symbol: Symbol): Promise<MarketSnapshot | null> => {
    const apiSymbol = toApiSymbol(symbol);

    try {
      const [tickerResponse, depthResponse, candles] = await Promise.all([
        omniClient.publicApi.tickers(apiSymbol),
        omniClient.publicApi.depth(apiSymbol, 5).catch<OmniDepth | null>(() => null),
        fetchKlines(symbol, '1', DEFAULT_KLINE_LOOKBACK).catch<MarketCandle[]>(() => []),
      ]);

      const ticker = (tickerResponse as OmniTicker[])[0];
      if (!ticker) {
        return null;
      }

      const lastPriceNumber = Number.parseFloat(ticker.lastPrice);
      if (!Number.isFinite(lastPriceNumber)) {
        return null;
      }

      const bestBid = extractBestPrice(depthResponse?.b);
      const bestAsk = extractBestPrice(depthResponse?.a);

      const atr13 = computeAtr(candles, ATR_PERIOD);

      return {
        symbol,
        lastPrice: toPriceString(lastPriceNumber),
        bid: bestBid ?? null,
        ask: bestAsk ?? null,
        atr13,
        atrMultiplier: defaultAtrMultiplier,
        stale: false,
        source: 'stream',
        serverTimestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(
        `Failed to load ApeX Omni market snapshot for ${symbol}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  };

  const getRecentCandles = async (
    symbol: Symbol,
    timeframe: Timeframe,
    limit: number,
  ): Promise<MarketCandle[]> => {
    const interval = TIMEFRAME_INTERVALS[timeframe] ?? TIMEFRAME_INTERVALS['1m'];
    const requested = Math.max(limit, ATR_PERIOD);

    try {
      const candles = await fetchKlines(symbol, interval, requested);
      return candles.slice(-limit);
    } catch (error) {
      throw new Error(
        `Failed to load ApeX Omni candles for ${symbol}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  };

  const connectMarketStream = ({
    symbols,
    onOpen,
    onMessage,
    onError,
    onClose,
  }: MarketStreamConnectOptions): MarketStreamConnection => {
    const shouldUsePrivateAuth = Boolean(passphrase && apiKey && apiSecret);

    const wsClient = new WSClient({
      endPoint: endpoint,
      publicUrl: publicWsUrl,
      privateUrl: privateWsUrl,
      apiKey: shouldUsePrivateAuth ? apiKey : '',
      passphrase: shouldUsePrivateAuth ? passphrase ?? '' : '',
      secret: shouldUsePrivateAuth ? apiSecret : '',
      heartbeatInterval: wsHeartbeatIntervalMs,
      maxReconnectAttempts: wsMaxReconnectAttempts,
      debug: false,
      callbacks: {
        onPublicConnect: () => {
          onOpen?.();
        },
        onPublicDisconnect: () => {
          onClose?.(1000, Buffer.from('public disconnect'));
        },
        onError: (_type: 'public' | 'private', error: Error) => {
          onError?.(error);
        },
        onMaxReconnectReached: () => {
          onError?.(new Error('ApeX Omni market stream reached max reconnect attempts'));
        },
      },
    } as unknown as ConstructorParameters<typeof WSClient>[0]);

    const handler = (payload: unknown) => {
      onMessage?.(payload);
    };

    for (const symbol of symbols) {
      const channel = `instrumentInfo.H.${toApiSymbol(symbol)}`;
      wsClient.subscribePublic(channel, handler);
    }

    return {
      close() {
        wsClient.close();
      },
    };
  };

  return {
    getMarketSnapshot,
    getRecentCandles,
    connectMarketStream,
  };
};
