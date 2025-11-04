import type { Symbol } from '@apex-tradebill/types';
import allowlistConfig from '../../../../../configs/markets/allowlist.json' with { type: 'json' };
import type { MarketMetadataPort, SymbolMetadata } from '../../domain/ports/tradebillPorts.js';

type AllowlistConfig = {
  symbols: string[];
};

const config = allowlistConfig as AllowlistConfig;

const DEFAULT_METADATA: Pick<
  SymbolMetadata,
  'tickSize' | 'stepSize' | 'minNotional' | 'minQuantity'
> = {
  tickSize: '0.01',
  stepSize: '0.000001',
  minNotional: '10.00',
  minQuantity: '0.000100',
};

const createDefaultMetadata = (symbol: Symbol): SymbolMetadata => ({
  symbol,
  status: 'tradable',
  displayName: symbol.replace('-USDT', '/USDT'),
  ...DEFAULT_METADATA,
});

export interface MarketMetadataService extends MarketMetadataPort {
  upsertMetadata(metadata: SymbolMetadata): Promise<SymbolMetadata>;
}

export const createMarketMetadataService = (seed: SymbolMetadata[] = []): MarketMetadataService => {
  const allowlisted = new Set<Symbol>(config.symbols as Symbol[]);
  const metadataStore = new Map<Symbol, SymbolMetadata>();

  for (const entry of seed) {
    if (allowlisted.has(entry.symbol)) {
      metadataStore.set(entry.symbol, entry);
    }
  }

  const ensureAllowlisted = (symbol: Symbol): void => {
    if (!allowlisted.has(symbol)) {
      throw new Error(`Symbol ${symbol} is not allowlisted`);
    }
  };

  const getMetadata = async (symbol: Symbol): Promise<SymbolMetadata | null> => {
    if (!allowlisted.has(symbol)) {
      return null;
    }

    if (!metadataStore.has(symbol)) {
      metadataStore.set(symbol, createDefaultMetadata(symbol));
    }

    return metadataStore.get(symbol) ?? null;
  };

  const listAllowlistedSymbols = async (): Promise<Symbol[]> => {
    return Array.from(allowlisted.values());
  };

  const upsertMetadata = async (metadata: SymbolMetadata): Promise<SymbolMetadata> => {
    ensureAllowlisted(metadata.symbol);
    metadataStore.set(metadata.symbol, metadata);
    return metadata;
  };

  return {
    getMetadata,
    listAllowlistedSymbols,
    upsertMetadata,
  };
};
