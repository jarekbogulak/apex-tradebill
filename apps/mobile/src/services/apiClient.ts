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
  getTradeHistory(params: { limit?: number; cursor?: string | null }): Promise<TradeHistoryResponse>;
  getSettings(): Promise<SettingsResponse>;
  updateSettings(patch: Partial<SettingsResponse>): Promise<SettingsResponse>;
  getEquity(): Promise<EquityResponse>;
}

const createHeaders = () => ({
  'Content-Type': 'application/json',
});

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Request failed (${response.status}): ${errorBody}`);
  }
  return response.json() as Promise<T>;
};

export const createApiClient = (baseUrl: string = env.api.baseUrl): ApiClient => {
  return {
    async previewTrade(input) {
      const response = await fetch(`${baseUrl}/v1/trades/preview`, {
        method: 'POST',
        headers: createHeaders(),
        body: JSON.stringify(input),
      });
      return handleResponse<TradePreviewResponse>(response);
    },
    async getTradeHistory({ limit = 20, cursor = null } = {}) {
      const params = new URLSearchParams();
      if (limit) {
        params.set('limit', String(limit));
      }
      if (cursor) {
        params.set('cursor', cursor);
      }

      const url = `${baseUrl}/v1/trades/history${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, { headers: createHeaders() });
      return handleResponse<TradeHistoryResponse>(response);
    },
    async getSettings() {
      const response = await fetch(`${baseUrl}/v1/settings`, { headers: createHeaders() });
      return handleResponse<SettingsResponse>(response);
    },
    async updateSettings(patch) {
      const response = await fetch(`${baseUrl}/v1/settings`, {
        method: 'PATCH',
        headers: createHeaders(),
        body: JSON.stringify(patch),
      });
      return handleResponse<SettingsResponse>(response);
    },
    async getEquity() {
      const response = await fetch(`${baseUrl}/v1/accounts/equity`, { headers: createHeaders() });
      return handleResponse<EquityResponse>(response);
    },
  };
};

export const createQueryClient = () => new QueryClient();
