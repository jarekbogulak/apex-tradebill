import type { Symbol as TradingSymbol } from '@apex-tradebill/types';
import type { OmniSecretService } from '@api/modules/omniSecrets/service.js';
import { createApeXOmniClient } from '../providers/apexOmni/client.js';
import type { MarketDataPort, MarketMetadataPort } from '../../../domain/ports/tradebillPorts.js';
import { env } from '../../../config/env.js';
import { createRingBuffer } from '../realtime/ringBuffer.js';
import type { RingBuffer } from '../realtime/ringBuffer.js';
import { createRingBufferMarketDataPort } from './ringBufferAdapter.js';
import { createInMemoryMarketDataProvider } from './marketDataProvider.inMemory.js';
import { DEFAULT_BASE_PRICES } from './defaults.js';
import { MarketDataUnavailableError } from './errors.js';

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

const createUnavailableMarketDataProvider = (
  message: string,
  details: string[] = [],
): MarketDataPort => {
  const error = new MarketDataUnavailableError(message, details);
  return {
    async getLatestSnapshot() {
      throw error;
    },
    async getRecentCandles() {
      throw error;
    },
  };
};

export const createMarketInfrastructure = async ({
  logger,
  marketMetadata,
  omniSecrets,
}: CreateMarketInfrastructureOptions): Promise<MarketInfrastructure> => {
  logger.info('market_infra.init', {
    allowInMemoryMarketData: env.apex.allowInMemoryMarketData,
    apexEnvironment: env.apex.connection.environment,
    wsUrl: env.apex.connection.wsUrl ?? null,
    restUrl: env.apex.connection.restUrl ?? null,
  });

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
        } catch {
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

    return {
      apiKey,
      apiSecret,
      passphrase,
      l2Seed,
    };
  })();

  const hasPrivateCredentials = Boolean(resolvedCredentials.apiKey && resolvedCredentials.apiSecret);
  if (!hasPrivateCredentials) {
    logger.info('apex.omni.public_only_mode', {
      apexEnvironment: env.apex.connection.environment,
    });
  }

  const ringBuffer = createRingBuffer();
  const client = createApeXOmniClient({
    apiKey: resolvedCredentials.apiKey,
    apiSecret: resolvedCredentials.apiSecret,
    passphrase: resolvedCredentials.passphrase,
    environment: env.apex.connection.environment,
    restBaseUrl: env.apex.connection.restUrl,
    wsBaseUrl: env.apex.connection.wsUrl,
  });

  logger.info('market_infra.credentials_resolved', {
    apexEnvironment: env.apex.connection.environment,
    restUrl: env.apex.connection.restUrl ?? '(default)',
    wsUrl: env.apex.connection.wsUrl ?? '(default)',
    privateAuth: hasPrivateCredentials,
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
    logger.warn('apex.omni.snapshot_failed_market_data_unavailable', {
      err: error,
      probeSymbol,
      allowInMemoryMarketData: env.apex.allowInMemoryMarketData,
      apexEnvironment: env.apex.connection.environment,
      wsUrl: env.apex.connection.wsUrl ?? '(default)',
      restUrl: env.apex.connection.restUrl ?? '(default)',
    });
    const message =
      'Live market data unavailable: ApeX Omni snapshot probe failed and synthetic data is disabled (APEX_ALLOW_IN_MEMORY_MARKET_DATA=false).';
    const details = [
      `Probe symbol: ${probeSymbol}`,
      'Verify ApeX Omni REST/WS connectivity; private streams require configured Omni credentials.',
      'Inspect server logs for the underlying connection error and retry after resolving it.',
    ];
    return {
      marketData: createUnavailableMarketDataProvider(message, details),
    };
  }

  const marketData = createRingBufferMarketDataPort({
    ringBuffer,
    client,
  });

  logger.info('market_infra.streaming_ready', {
    apexEnvironment: env.apex.connection.environment,
    symbols: symbols.join(','),
    wsUrl: env.apex.connection.wsUrl ?? '(default)',
    restUrl: env.apex.connection.restUrl ?? '(default)',
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
