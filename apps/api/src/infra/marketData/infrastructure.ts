import type { Symbol as TradingSymbol } from '@apex-tradebill/types';
import { createApeXOmniClient } from '../../clients/apexOmniClient.js';
import type { MarketDataPort, MarketMetadataPort } from '../../domain/ports/tradebillPorts.js';
import { env } from '../../config/env.js';
import { createRingBuffer } from '../../realtime/ringBuffer.js';
import type { RingBuffer } from '../../realtime/ringBuffer.js';
import { createRingBufferMarketDataPort } from './ringBufferAdapter.js';
import { createInMemoryMarketDataPort } from './inMemoryMarketDataPort.js';
import { DEFAULT_BASE_PRICES } from './defaults.js';

export interface MarketInfrastructure {
  marketData: MarketDataPort;
  ringBuffer?: RingBuffer;
  streaming?: {
    client: ReturnType<typeof createApeXOmniClient>;
    symbols: TradingSymbol[];
  };
}

export interface MarketInfrastructureLogger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
}

export interface CreateMarketInfrastructureOptions {
  logger: MarketInfrastructureLogger;
  marketMetadata: MarketMetadataPort;
}

const buildStreamingSymbols = (allowlisted: TradingSymbol[]): TradingSymbol[] => {
  if (allowlisted.length > 0) {
    return allowlisted;
  }

  return Object.keys(DEFAULT_BASE_PRICES) as TradingSymbol[];
};

export const createMarketInfrastructure = async ({
  logger,
  marketMetadata,
}: CreateMarketInfrastructureOptions): Promise<MarketInfrastructure> => {
  const credentials = env.apex.credentials;
  if (!credentials) {
    logger.warn(
      'ApeX Omni credentials missing – using in-memory market data (APEX_ALLOW_IN_MEMORY_MARKET_DATA=true)',
    );
    return {
      marketData: createInMemoryMarketDataPort(),
    };
  }

  const ringBuffer = createRingBuffer();
  const client = createApeXOmniClient({
    apiKey: credentials.apiKey,
    apiSecret: credentials.apiSecret,
    passphrase: credentials.passphrase,
    environment: credentials.environment,
    restBaseUrl: credentials.restUrl,
    wsBaseUrl: credentials.wsUrl,
  });

  const allowlisted = await marketMetadata.listAllowlistedSymbols();
  const symbols = buildStreamingSymbols(allowlisted);

  const probeSymbol = symbols[0] ?? ('BTC-USDT' as TradingSymbol);
  try {
    const snapshot = await client.getMarketSnapshot(probeSymbol);
    if (!snapshot) {
      throw new Error(`Received empty snapshot for ${probeSymbol}`);
    }
  } catch (error) {
    logger.warn(
      'apex.omni.snapshot_failed_falling_back_to_in_memory_market_data',
      { err: error, probeSymbol },
    );
    return {
      marketData: createInMemoryMarketDataPort(),
    };
  }

  const marketData = createRingBufferMarketDataPort({
    ringBuffer,
    client,
  });

  return {
    marketData,
    ringBuffer,
    streaming: {
      client,
      symbols,
    },
  };
};
