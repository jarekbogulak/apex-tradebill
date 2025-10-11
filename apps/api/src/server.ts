import Fastify, { type FastifyInstance } from 'fastify';
import {
  type MarketSnapshot,
  type Symbol as TradingSymbol,
} from '@apex-tradebill/types';
import { fileURLToPath } from 'node:url';
import { createMarketMetadataService } from './services/markets/marketMetadataService.js';
import {
  createInMemoryTradeCalculationRepository,
  type TradeCalculationRepository,
} from './domain/trade-calculation/trade-calculation.entity.js';
import { createTradePreviewService } from './services/trades/previewService.js';
import { createTradeHistoryService } from './services/trades/historyService.js';
import { createSettingsService } from './services/settings/settingsService.js';
import { createInMemoryUserSettingsRepository } from './domain/user-settings/user-settings.entity.js';
import { createEquityService } from './services/accounts/equityService.js';
import type {
  AccountEquityPort,
  MarketCandle,
  MarketDataPort,
  MarketMetadataPort,
} from './domain/ports/tradebillPorts.js';
import getSymbolRoute from './routes/markets/getSymbol.js';
import postPreviewRoute from './routes/trades/postPreview.js';
import getHistoryRoute from './routes/trades/getHistory.js';
import getSettingsRoute from './routes/settings/getSettings.js';
import patchSettingsRoute from './routes/settings/patchSettings.js';
import getEquityRoute from './routes/accounts/getEquity.js';
import marketDataStreamRoute from './routes/stream/marketData.js';
import { DEFAULT_USER_ID } from './routes/http.js';

const BASE_PRICES: Record<TradingSymbol, number> = {
  'BTC-USDT': 65_000,
  'ETH-USDT': 3_200,
};

const formatPrice = (value: number, fractionDigits = 2): string => {
  return value.toFixed(fractionDigits);
};

const generateCandleSeries = (symbol: TradingSymbol, count = 128): MarketCandle[] => {
  const base = BASE_PRICES[symbol] ?? 1_000;
  const now = Date.now();

  return Array.from({ length: count }).map((_, index) => {
    const drift = index * 5;
    const direction = index % 2 === 0 ? 1 : -1;
    const close = base + drift + direction * 3;
    const high = close + 12;
    const low = close - 12;

    return {
      timestamp: new Date(now - (count - index) * 60_000).toISOString(),
      high,
      low,
      close,
    };
  });
};

const createSnapshot = (symbol: TradingSymbol, close: number): MarketSnapshot => {
  const bid = close - 2;
  const ask = close + 2;

  return {
    symbol,
    lastPrice: formatPrice(close, 2),
    bid: formatPrice(bid, 2),
    ask: formatPrice(ask, 2),
    atr13: '0.00000000',
    atrMultiplier: '1.50',
    stale: false,
    source: 'stream',
    serverTimestamp: new Date().toISOString(),
  };
};

const createInMemoryMarketDataPort = (): MarketDataPort => {
  const seriesBySymbol = new Map<TradingSymbol, MarketCandle[]>();

  const ensureSeries = (symbol: TradingSymbol): MarketCandle[] => {
    if (!seriesBySymbol.has(symbol)) {
      seriesBySymbol.set(symbol, generateCandleSeries(symbol));
    }
    return seriesBySymbol.get(symbol) ?? [];
  };

  return {
    async getLatestSnapshot(symbol) {
      const series = ensureSeries(symbol);
      if (series.length === 0) {
        return null;
      }

      const lastClose = series[series.length - 1]?.close ?? BASE_PRICES[symbol] ?? 1_000;
      const drift = Math.sin(Date.now() / 60_000) * 25;
      return createSnapshot(symbol, lastClose + drift);
    },
    async getRecentCandles(symbol, _timeframe, lookback) {
      const series = ensureSeries(symbol);
      if (series.length === 0) {
        return [];
      }

      const sliceStart = Math.max(series.length - lookback, 0);
      return series.slice(sliceStart);
    },
  };
};

const createInMemoryEquityPort = (): AccountEquityPort => {
  const store = new Map<string, { equity: string; lastSyncedAt: string; source: 'connected' | 'manual' }>();

  store.set(DEFAULT_USER_ID, {
    source: 'connected',
    equity: '25000.00',
    lastSyncedAt: new Date().toISOString(),
  });

  return {
    async getEquity(userId) {
      const snapshot = store.get(userId);
      if (!snapshot) {
        return null;
      }
      return {
        source: snapshot.source,
        equity: snapshot.equity,
        lastSyncedAt: snapshot.lastSyncedAt,
      };
    },
    async setManualEquity(userId, equity) {
      const updated = {
        source: 'manual' as const,
        equity,
        lastSyncedAt: new Date().toISOString(),
      };
      store.set(userId, updated);
      return updated;
    },
  };
};

const createServices = (marketMetadata: MarketMetadataPort) => {
  const tradeCalculations: TradeCalculationRepository = createInMemoryTradeCalculationRepository();
  const marketData: MarketDataPort = createInMemoryMarketDataPort();
  const previewService = createTradePreviewService({
    marketData,
    metadata: marketMetadata,
    tradeCalculations,
  });

  const historyService = createTradeHistoryService({
    tradeCalculations,
  });

  const userSettingsRepository = createInMemoryUserSettingsRepository();
  const settingsService = createSettingsService({
    repository: userSettingsRepository,
    metadata: marketMetadata,
  });

  const equityPort = createInMemoryEquityPort();
  const equityService = createEquityService({ equityPort });

  return {
    marketData,
    previewService,
    historyService,
    settingsService,
    equityService,
  };
};

export const buildServer = async (): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  });

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  const marketMetadataService = createMarketMetadataService();
  const services = createServices(marketMetadataService);

  await app.register(getSymbolRoute, {
    metadata: marketMetadataService,
  });

  await app.register(postPreviewRoute, {
    previewService: services.previewService,
  });

  await app.register(getHistoryRoute, {
    historyService: services.historyService,
  });

  await app.register(getSettingsRoute, {
    settingsService: services.settingsService,
  });

  await app.register(patchSettingsRoute, {
    settingsService: services.settingsService,
  });

  await app.register(getEquityRoute, {
    equityService: services.equityService,
  });

  await app.register(marketDataStreamRoute, {
    marketData: services.marketData,
    metadata: marketMetadataService,
  });

  return app;
};

const start = async () => {
  const port = Number.parseInt(process.env.PORT ?? '4000', 10);
  const host = process.env.HOST ?? '0.0.0.0';

  const server = await buildServer();

  try {
    await server.listen({ port, host });
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
};

const isDirectRun = () => {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }

  return entry === fileURLToPath(import.meta.url);
};

if (isDirectRun()) {
  void start();
}
