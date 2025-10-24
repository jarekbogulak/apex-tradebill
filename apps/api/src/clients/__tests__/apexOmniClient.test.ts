import type { MarketSnapshot } from '@apex-tradebill/types';
import { createApeXOmniClient } from '../apexOmniClient.js';

let mockCalculateAtr: jest.Mock;
let capturedWsConfig: Record<string, unknown> | null = null;

jest.mock('apexomni-connector-node', () => {
  const createOmniClient = jest.fn();
  class OmniENV {
    baseUrl: string;
    networkId: number;
    isProd: boolean;
    constructor(baseUrl: string, networkId: number) {
      this.baseUrl = baseUrl;
      this.networkId = networkId;
      this.isProd = !baseUrl.includes('qa');
    }
  }
  return {
    ApexClient: {
      createOmniClient,
    },
    OmniENV,
    OMNI_PROD: { baseUrl: 'https://prod.api', networkId: 1, isProd: true },
    OMNI_QA: { baseUrl: 'https://qa.api', networkId: 2, isProd: false },
  };
});

const { ApexClient } = jest.requireMock('apexomni-connector-node') as {
  ApexClient: { createOmniClient: jest.Mock };
};
const mockCreateOmniClient = ApexClient.createOmniClient;

jest.mock('apexomni-connector-node/lib/omni/Constant.js', () => ({
  PUBLIC_WSS: '/public',
  PRIVATE_WSS: '/private',
  WS_PROD: 'wss://prod.omni',
  WS_QA: 'wss://qa.omni',
}));

jest.mock('apexomni-connector-node/lib/ws/WSClient.js', () => {
  const subscribePublic = jest.fn();
  const close = jest.fn();
  const WSClient = jest.fn().mockImplementation((config: Record<string, unknown>) => {
    capturedWsConfig = config;
    return {
      subscribePublic,
      close,
    };
  });
  return {
    WSClient,
    __subscribePublic: subscribePublic,
    __close: close,
  };
});

const { WSClient, __subscribePublic, __close } = jest.requireMock(
  'apexomni-connector-node/lib/ws/WSClient.js',
) as {
  WSClient: jest.Mock;
  __subscribePublic: jest.Mock;
  __close: jest.Mock;
};
const mockSubscribePublic = __subscribePublic;
const mockClose = __close;

jest.mock('../../services/calculations/atrCalculator.js', () => ({
  calculateAtr: jest.fn(() => ({ value: 12.3456 })),
}));

({ calculateAtr: mockCalculateAtr } = jest.requireMock(
  '../../services/calculations/atrCalculator.js',
) as { calculateAtr: jest.Mock });

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
    mockCreateOmniClient.mockReset();
    mockCalculateAtr.mockClear();
    mockSubscribePublic.mockReset();
    mockClose.mockReset();
    WSClient.mockClear();
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

    mockCreateOmniClient.mockReturnValue({ publicApi });

    const client = createApeXOmniClient({
      apiKey: 'key',
      apiSecret: 'secret',
      defaultAtrMultiplier: '1.75',
      environment: 'qa',
    });

    const snapshot = await client.getMarketSnapshot('BTC-USDT');

    expect(publicApi.tickers).toHaveBeenCalledWith('BTCUSDT');
    expect(publicApi.depth).toHaveBeenCalledWith('BTCUSDT', 5);
    expect(publicApi.klines).toHaveBeenCalledWith('BTCUSDT', '1', undefined, undefined, 64);
    expect(mockCalculateAtr).toHaveBeenCalledWith(expect.any(Array), 13);
    expect(snapshot).toMatchObject<Partial<MarketSnapshot>>({
      symbol: 'BTC-USDT',
      lastPrice: '45000.12340000',
      bid: '44999.90',
      ask: '45001.10',
      atr13: '12.34560000',
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

    mockCreateOmniClient.mockReturnValue({ publicApi });

    const client = createApeXOmniClient({
      apiKey: 'key',
      apiSecret: 'secret',
      environment: 'prod',
    });

    const candles = await client.getRecentCandles('BTC-USDT', '5m', 5);

    expect(publicApi.klines).toHaveBeenCalledWith('BTCUSDT', '5', undefined, undefined, 13);
    expect(candles).toHaveLength(5);
    expect(candles[0]).toHaveProperty('timestamp');
  });

  it('wires WebSocket client and surfaces callbacks', () => {
    mockCreateOmniClient.mockReturnValue({ publicApi: {} });

    const onOpen = jest.fn();
    const onMessage = jest.fn();
    const onError = jest.fn();
    const onClose = jest.fn((code: number, reason: Buffer | string | undefined) => {
      void code;
      void reason;
    });

    const client = createApeXOmniClient({
      apiKey: 'key',
      apiSecret: 'secret',
      passphrase: 'pass',
      wsBaseUrl: 'wss://custom.endpoint//',
      wsHeartbeatIntervalMs: 2500,
      wsMaxReconnectAttempts: 5,
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
      publicUrl: 'wss://custom.endpoint/public',
      privateUrl: 'wss://custom.endpoint/private',
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
