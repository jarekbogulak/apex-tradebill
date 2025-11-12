import type { Timeframe } from '@apex-tradebill/types';
import type { MarketMetadataPort } from '../ports/tradebillPorts.js';
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
} from '../user-settings/user-settings.entity.js';

export interface ResolveSettingsDeps {
  repository: UserSettingsRepository;
  metadata: MarketMetadataPort;
  defaults?: {
    fallbackSymbol?: string;
  };
}

export interface UpdateSettingsInput {
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

const resolveDefaultSymbol = async ({
  metadata,
  defaults,
}: Pick<ResolveSettingsDeps, 'metadata' | 'defaults'>): Promise<string> => {
  const allowlisted = await metadata.listAllowlistedSymbols();
  return allowlisted[0] ?? defaults?.fallbackSymbol ?? 'BTC-USDT';
};

export const makeGetUserSettings = ({
  repository,
  metadata,
  defaults = {},
}: ResolveSettingsDeps) => {
  return async (userId: string): Promise<UserSettings> => {
    const existing = await repository.findByUserId(userId);
    if (existing) {
      return existing;
    }

    const symbol = await resolveDefaultSymbol({ metadata, defaults });
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
};

export const makeUpdateUserSettings = ({
  repository,
  metadata,
  defaults = {},
}: ResolveSettingsDeps) => {
  const getUserSettings = makeGetUserSettings({ repository, metadata, defaults });

  return async (userId: string, patch: UpdateSettingsInput): Promise<UserSettings> => {
    const current = await getUserSettings(userId);

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
};

export type GetUserSettingsUseCase = ReturnType<typeof makeGetUserSettings>;
export type UpdateUserSettingsUseCase = ReturnType<typeof makeUpdateUserSettings>;
