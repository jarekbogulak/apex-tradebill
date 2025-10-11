import type { Timeframe } from '@apex-tradebill/types';
import type { MarketMetadataPort } from '../../domain/ports/tradebillPorts.js';
import {
  DEFAULT_ATR_MULTIPLIER,
  DEFAULT_FRESHNESS_MS,
  DEFAULT_RISK_PERCENT,
  DEFAULT_TIMEFRAME,
  createUserSettings,
  updateUserSettings,
  type UpdateUserSettingsInput,
  type UserSettings,
  type UserSettingsRepository,
} from '../../domain/user-settings/user-settings.entity.js';

export interface SettingsServiceDeps {
  repository: UserSettingsRepository;
  metadata: MarketMetadataPort;
  defaults?: {
    fallbackSymbol?: string;
  };
}

export interface SettingsPatchInput {
  riskPercent?: number;
  atrMultiplier?: number;
  dataFreshnessThresholdMs?: number;
  rememberedMultiplierOptions?: number[];
  defaultSymbol?: string;
  defaultTimeframe?: Timeframe;
}

const ensureSymbolTradable = async (
  metadata: MarketMetadataPort,
  symbol: string,
): Promise<void> => {
  const info = await metadata.getMetadata(symbol);
  if (!info) {
    throw new Error(`Symbol ${symbol} is not allowlisted`);
  }
  if (info.status !== 'tradable') {
    throw new Error(`Symbol ${symbol} is currently suspended`);
  }
};

export const createSettingsService = ({
  repository,
  metadata,
  defaults = {},
}: SettingsServiceDeps) => {
  const resolveDefaultSymbol = async (): Promise<string> => {
    const allowlisted = await metadata.listAllowlistedSymbols();
    return allowlisted[0] ?? defaults.fallbackSymbol ?? 'BTC-USDT';
  };

  const get = async (userId: string): Promise<UserSettings> => {
    const existing = await repository.findByUserId(userId);
    if (existing) {
      return existing;
    }

    const symbol = await resolveDefaultSymbol();
    const created = createUserSettings({
      userId,
      defaultSymbol: symbol,
      riskPercent: DEFAULT_RISK_PERCENT,
      atrMultiplier: DEFAULT_ATR_MULTIPLIER,
      dataFreshnessThresholdMs: DEFAULT_FRESHNESS_MS,
      defaultTimeframe: DEFAULT_TIMEFRAME,
    });

    await repository.save(created);
    return created;
  };

  const update = async (userId: string, patch: SettingsPatchInput): Promise<UserSettings> => {
    const current = await get(userId);

    if (patch.defaultSymbol) {
      await ensureSymbolTradable(metadata, patch.defaultSymbol);
    }

    const updates: UpdateUserSettingsInput = {
      ...patch,
      rememberedMultiplierOptions: patch.rememberedMultiplierOptions,
    };

    const updated = updateUserSettings(current, updates);
    await repository.save(updated);
    return updated;
  };

  return {
    get,
    update,
  };
};
