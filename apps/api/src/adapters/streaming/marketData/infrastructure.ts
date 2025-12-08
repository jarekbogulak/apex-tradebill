import type { Symbol as TradingSymbol } from '@apex-tradebill/types';
import { createApeXOmniClient } from '../providers/apexOmni/client.js';
import type { MarketDataPort, MarketMetadataPort } from '../../../domain/ports/tradebillPorts.js';
import { env } from '../../../config/env.js';
import { createRingBuffer } from '../realtime/ringBuffer.js';
import type { RingBuffer } from '../realtime/ringBuffer.js';
import { createRingBufferMarketDataPort } from './ringBufferAdapter.js';
import { createInMemoryMarketDataProvider } from './marketDataProvider.inMemory.js';
import { DEFAULT_BASE_PRICES } from './defaults.js';
import type { OmniSecretService } from '@api/modules/omniSecrets/service.js';

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
  omniSecrets?: OmniSecretService;
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
  omniSecrets,
}: CreateMarketInfrastructureOptions): Promise<MarketInfrastructure> => {
  if (env.apex.allowInMemoryMarketData) {
    logger.warn(
      'Using in-memory market data (APEX_ALLOW_IN_MEMORY_MARKET_DATA=true); Apex Omni streaming disabled for tests.',
    );
    return {
      marketData: createInMemoryMarketDataProvider(),
    };
  }

  const resolvedCredentials = await (async () => {
    const base = env.apex.credentials;

    let apiKey = base?.apiKey;
    let apiSecret = base?.apiSecret;
    let passphrase = base?.passphrase;
    let l2Seed = base?.l2Seed;

    if (omniSecrets) {
      const loadSecret = async (
        secretType:
          | 'trading_api_key'
          | 'trading_client_secret'
          | 'trading_api_passphrase'
          | 'zk_signing_seed',
      ) => {
        try {
          const result = await omniSecrets.getSecretValue(secretType);
          return result.value;
        } catch (error) {
          logger.warn('omni.secret_fetch_failed', { secretType, err: error });
          return null;
        }
      };

      const [fetchedApiKey, fetchedApiSecret, fetchedPassphrase, fetchedSeed] = await Promise.all([
        loadSecret('trading_api_key'),
        loadSecret('trading_client_secret'),
        loadSecret('trading_api_passphrase'),
        loadSecret('zk_signing_seed'),
      ]);

      apiKey = fetchedApiKey ?? apiKey;
      apiSecret = fetchedApiSecret ?? apiSecret;
      passphrase = fetchedPassphrase ?? passphrase;
      l2Seed = fetchedSeed ?? l2Seed;
    }

    if (!apiKey || !apiSecret) {
      return null;
    }

    return {
      apiKey,
      apiSecret,
      passphrase,
      environment: base?.environment ?? 'prod',
      restUrl: base?.restUrl,
      wsUrl: base?.wsUrl,
      l2Seed,
    };
  })();

  if (!resolvedCredentials) {
    logger.warn(
      'ApeX Omni credentials missing – using in-memory market data (APEX_ALLOW_IN_MEMORY_MARKET_DATA=true)',
    );
    return {
      marketData: createInMemoryMarketDataProvider(),
    };
  }

  const ringBuffer = createRingBuffer();
  const client = createApeXOmniClient({
    apiKey: resolvedCredentials.apiKey,
    apiSecret: resolvedCredentials.apiSecret,
    passphrase: resolvedCredentials.passphrase,
    environment: resolvedCredentials.environment,
    restBaseUrl: resolvedCredentials.restUrl,
    wsBaseUrl: resolvedCredentials.wsUrl,
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
    logger.warn('apex.omni.snapshot_failed_falling_back_to_in_memory_market_data', {
      err: error,
      probeSymbol,
    });
    return {
      marketData: createInMemoryMarketDataProvider(),
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
