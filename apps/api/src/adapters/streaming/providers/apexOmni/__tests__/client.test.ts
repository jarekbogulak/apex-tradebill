import type { MarketSnapshot } from '@apex-tradebill/types';
import type { WSClient } from 'apexomni-connector-node/lib/ws/WSClient.js';
import { createApeXOmniClient } from '../client.js';

let capturedWsConfig: ConstructorParameters<typeof WSClient>[0] | null = null;
let mockSubscribePublic: jest.Mock;
let mockClose: jest.Mock;

jest.mock('@api/domain/trading/atrCalculator.js', () => ({
  calculateAtr: jest.fn(() => ({ value: 12.3456 })),
}));

const { calculateAtr: mockCalculateAtr } = jest.requireMock('@api/domain/trading/atrCalculator.js') as {
  calculateAtr: jest.Mock;
};

const buildKlines = (count: number) => {
  return Array.from({ length: count }, (_, index) => ({
    t: 1_700_000_000_000 + index * 60_000,
    h: '45010.0',
    l: '44990.0',
    c: (45000 + index * 10).toFixed(2),
  }));
};

describe('createApeXOmniClient', () => {
  beforeEach(() => {
    mockCalculateAtr.mockClear();
    mockSubscribePublic = jest.fn();
    mockClose = jest.fn();
    capturedWsConfig = null;
  });

  it('derives market snapshots using REST helpers', async () => {
    const publicApi = {
      tickers: jest.fn().mockResolvedValue([
        {
          symbol: 'BTCUSDT',
          lastPrice: '45000.1234',
        },
      ]),
      depth: jest.fn().mockResolvedValue({
        a: [['45001.10', '1.0']],
        b: [['44999.90', '2.0']],
      }),
      klines: jest.fn().mockResolvedValue({
        BTCUSDT: buildKlines(32),
      }),
    };

    const client = createApeXOmniClient({
      apiKey: 'key',
      apiSecret: 'secret',
      defaultAtrMultiplier: '1.75',
      environment: 'qa',
      omniClient: { publicApi },
    });

    const snapshot = await client.getMarketSnapshot('BTC-USDT');

    expect(publicApi.tickers).toHaveBeenCalledWith('BTCUSDT');
    expect(publicApi.depth).toHaveBeenCalledWith('BTCUSDT', 5);
    expect(publicApi.klines).toHaveBeenCalledWith('BTCUSDT', '1', undefined, undefined, 64);
    expect(snapshot).toMatchObject<Partial<MarketSnapshot>>({
      symbol: 'BTC-USDT',
      lastPrice: '45000.12340000',
      bid: '44999.90',
      ask: '45001.10',
      atrMultiplier: '1.75',
      stale: false,
      source: 'stream',
    });
  });

  it('returns sliced candles with timeframe mapping', async () => {
    const publicApi = {
      tickers: jest.fn(),
      depth: jest.fn(),
      klines: jest.fn().mockResolvedValue({
        BTCUSDT: buildKlines(20),
      }),
    };

    const client = createApeXOmniClient({
      apiKey: 'key',
      apiSecret: 'secret',
      environment: 'prod',
      omniClient: { publicApi },
    });

    const candles = await client.getRecentCandles('BTC-USDT', '5m', 5);

    expect(publicApi.klines).toHaveBeenCalledWith('BTCUSDT', '5', undefined, undefined, 13);
    expect(candles).toHaveLength(5);
    expect(candles[0]).toHaveProperty('timestamp');
  });

  it('wires WebSocket client and surfaces callbacks', () => {
    const onOpen = jest.fn();
    const onMessage = jest.fn();
    const onError = jest.fn();
    const onClose = jest.fn((code: number, reason: Buffer | string | undefined) => {
      void code;
      void reason;
    });
    const publicApi = {
      tickers: jest.fn(async () => []),
      depth: jest.fn(async () => ({})),
      klines: jest.fn(async () => ({})),
    };

    const client = createApeXOmniClient({
      apiKey: 'key',
      apiSecret: 'secret',
      passphrase: 'pass',
      wsBaseUrl: 'wss://custom.endpoint//',
      wsHeartbeatIntervalMs: 2500,
      wsMaxReconnectAttempts: 5,
      omniClient: { publicApi },
      wsClientFactory: (config) => {
        capturedWsConfig = config;
        return {
          subscribePublic: mockSubscribePublic,
          close: mockClose,
        };
      },
    });

    const connection = client.connectMarketStream({
      symbols: ['BTC-USDT'],
      onOpen,
      onMessage,
      onError,
      onClose,
    });

    expect(capturedWsConfig).toMatchObject({
      endPoint: 'wss://custom.endpoint',
      publicUrl: 'wss://custom.endpoint/realtime_public?v=2',
      privateUrl: 'wss://custom.endpoint/realtime_private?v=2',
      apiKey: 'key',
      passphrase: 'pass',
      secret: 'secret',
      heartbeatInterval: 2500,
      maxReconnectAttempts: 5,
    });
    expect(mockSubscribePublic).toHaveBeenCalledWith(
      'instrumentInfo.H.BTCUSDT',
      expect.any(Function),
    );

    const [, handler] = mockSubscribePublic.mock.calls[0] as [string, (payload: unknown) => void];
    handler({ foo: 'bar' });
    expect(onMessage).toHaveBeenCalledWith({ foo: 'bar' });

    const callbacks = (capturedWsConfig?.callbacks ?? {}) as {
      onPublicConnect?: () => void;
      onPublicDisconnect?: () => void;
      onError?: (channel: string, error: unknown) => void;
      onMaxReconnectReached?: () => void;
    };
    callbacks.onPublicConnect?.();
    expect(onOpen).toHaveBeenCalled();

    callbacks.onPublicDisconnect?.();
    expect(onClose as jest.Mock).toHaveBeenCalledWith(1000, expect.any(Buffer));

    callbacks.onError?.('public', new Error('ws failed'));
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'ws failed' }));

    callbacks.onMaxReconnectReached?.();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'ApeX Omni market stream reached max reconnect attempts',
      }),
    );

    connection.close();
    expect(mockClose).toHaveBeenCalled();
  });
});
