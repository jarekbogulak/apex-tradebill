import type { MarketDataPort, MarketMetadataPort } from '../domain/ports/tradebillPorts.js';
import type { TradeCalculationRepository } from '../domain/trade-calculation/trade-calculation.entity.js';
import {
  makeExecuteTrade,
  makePreviewTrade,
  type ExecuteTradeUseCase,
  type PreviewTradeUseCase,
} from '../domain/trading/tradePreview.usecases.js';
import {
  makeImportTradeHistory,
  makeTradeHistoryManager,
  type ImportTradeHistoryUseCase,
  type TradeHistoryManager,
} from '../domain/trading/tradeHistory.usecases.js';
import { createInMemoryUserSettingsRepository } from '../domain/user-settings/user-settings.entity.js';
import {
  makeGetUserSettings,
  makeUpdateUserSettings,
  type GetUserSettingsUseCase,
  type UpdateUserSettingsUseCase,
} from '../domain/settings/settings.usecases.js';
import { createInMemoryEquityRepository } from '../adapters/persistence/accounts/equityRepository.inMemory.js';
import {
  makeGetEquitySnapshot,
  makeSetManualEquity,
  type GetEquitySnapshotUseCase,
  type SetManualEquityUseCase,
} from '../domain/accounts/equity.usecases.js';

export interface AppDeps {
  marketData: MarketDataPort;
  previewTrade: PreviewTradeUseCase;
  executeTrade: ExecuteTradeUseCase;
  tradeHistory: TradeHistoryManager;
  importTradeHistory: ImportTradeHistoryUseCase;
  getUserSettings: GetUserSettingsUseCase;
  updateUserSettings: UpdateUserSettingsUseCase;
  getEquitySnapshot: GetEquitySnapshotUseCase;
  setManualEquity: SetManualEquityUseCase;
  tradeCalculations: TradeCalculationRepository;
}

export interface BuildAppDepsOptions {
  marketMetadata: MarketMetadataPort;
  marketData: MarketDataPort;
  tradeCalculations: TradeCalculationRepository;
  tradeCalculationsPersistent: boolean;
  seedEquityUserId?: string;
}

export const buildAppDeps = ({
  marketMetadata,
  marketData,
  tradeCalculations,
  tradeCalculationsPersistent,
  seedEquityUserId,
}: BuildAppDepsOptions): AppDeps => {
  const previewTrade = makePreviewTrade({
    marketData,
    metadata: marketMetadata,
  });

  const executeTrade = makeExecuteTrade({
    marketData,
    metadata: marketMetadata,
    tradeCalculations,
  });

  const tradeHistory = makeTradeHistoryManager({
    tradeCalculations,
    isPersistent: tradeCalculationsPersistent,
  });

  const importTradeHistory = makeImportTradeHistory({
    tradeCalculations,
  });

  const userSettingsRepository = createInMemoryUserSettingsRepository();
  const getUserSettings = makeGetUserSettings({
    repository: userSettingsRepository,
    metadata: marketMetadata,
  });
  const updateUserSettings = makeUpdateUserSettings({
    repository: userSettingsRepository,
    metadata: marketMetadata,
  });

  const equityPort = createInMemoryEquityRepository({ seedUserId: seedEquityUserId });
  const getEquitySnapshot = makeGetEquitySnapshot({ equityPort });
  const setManualEquity = makeSetManualEquity({ equityPort });

  return {
    marketData,
    previewTrade,
    executeTrade,
    tradeHistory,
    importTradeHistory,
    getUserSettings,
    updateUserSettings,
    getEquitySnapshot,
    setManualEquity,
    tradeCalculations,
  };
};
