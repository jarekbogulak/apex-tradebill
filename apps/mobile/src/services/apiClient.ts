import type {
  MarketSnapshot,
  TradeCalculation,
  TradeInput,
  TradeOutput,
  TradeWarningCode,
} from '@apex-tradebill/types';
import { QueryClient } from '@tanstack/react-query';
import { env } from '../config/env';

export interface TradePreviewResponse {
  output: TradeOutput;
  marketSnapshot: MarketSnapshot;
  warnings: TradeWarningCode[];
}

export interface TradeExecuteResponse extends TradePreviewResponse {
  calculation: TradeCalculation;
}

export interface TradeHistoryResponse {
  items: TradeCalculation[];
  nextCursor: string | null;
}

export interface SettingsResponse {
  riskPercent: string;
  atrMultiplier: string;
  dataFreshnessThresholdMs: number;
  defaultSymbol: string;
  defaultTimeframe: string;
  rememberedMultiplierOptions: string[];
}

export interface EquityResponse {
  source: 'connected' | 'manual';
  equity: string;
  lastSyncedAt: string;
}

export interface ApiClient {
  previewTrade(input: TradeInput): Promise<TradePreviewResponse>;
  executeTrade(input: TradeInput): Promise<TradeExecuteResponse>;
  getTradeHistory(params: {
    limit?: number;
    cursor?: string | null;
    signal?: AbortSignal;
  }): Promise<TradeHistoryResponse>;
  getSettings(): Promise<SettingsResponse>;
  updateSettings(patch: Partial<SettingsResponse>): Promise<SettingsResponse>;
  getEquity(): Promise<EquityResponse>;
}

const createHeaders = () => ({
  'Content-Type': 'application/json',
});

const parseJsonResponse = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}): ${text}`);
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(`Failed to parse response JSON: ${text}`, { cause: error });
  }
};

export const createApiClient = (baseUrl: string = env.api.baseUrl): ApiClient => {
  return {
    async previewTrade(input) {
      const response = await fetch(`${baseUrl}/v1/trades/preview`, {
        method: 'POST',
        headers: createHeaders(),
        body: JSON.stringify(input),
      });
      return parseJsonResponse<TradePreviewResponse>(response);
    },
    async executeTrade(input) {
      const response = await fetch(`${baseUrl}/v1/trades/execute`, {
        method: 'POST',
        headers: createHeaders(),
        body: JSON.stringify(input),
      });
      return parseJsonResponse<TradeExecuteResponse>(response);
    },
    async getTradeHistory({ limit = 20, cursor = null, signal } = {}) {
      const params = new URLSearchParams();
      if (limit) {
        params.set('limit', String(limit));
      }
      if (cursor) {
        params.set('cursor', cursor);
      }

      const url = `${baseUrl}/v1/trades/history${params.toString() ? `?${params.toString()}` : ''}`;
      const requestInit: RequestInit = {
        headers: createHeaders(),
      };
      if (signal) {
        // React Query provides a DOM AbortSignal; React Native fetch expects the global variant.
        (requestInit as { signal: globalThis.AbortSignal }).signal =
          signal as unknown as globalThis.AbortSignal;
      }
      const response = await fetch(url, requestInit);
      return parseJsonResponse<TradeHistoryResponse>(response);
    },
    async getSettings() {
      const response = await fetch(`${baseUrl}/v1/settings`, { headers: createHeaders() });
      return parseJsonResponse<SettingsResponse>(response);
    },
    async updateSettings(patch) {
      const response = await fetch(`${baseUrl}/v1/settings`, {
        method: 'PATCH',
        headers: createHeaders(),
        body: JSON.stringify(patch),
      });
      return parseJsonResponse<SettingsResponse>(response);
    },
    async getEquity() {
      const response = await fetch(`${baseUrl}/v1/accounts/equity`, { headers: createHeaders() });
      return parseJsonResponse<EquityResponse>(response);
    },
  };
};

export const createQueryClient = () => new QueryClient();
