import fastify from 'fastify';
import type { ApeXOmniClient } from '../../adapters/streaming/providers/apexOmni/client.js';
import type { RingBuffer } from '../../adapters/streaming/realtime/ringBuffer.js';
import type { Observability } from '../observability.js';
import { marketStreamPlugin } from '../marketStream.js';

const createRingBufferMock = (): RingBuffer => ({
  ingest: jest.fn(),
  getSnapshot: jest.fn(),
  getRecentCandles: jest.fn(),
  getTicks: jest.fn(),
  sampleTicks: jest.fn(),
  markStale: jest.fn(),
  getTrackedSymbols: jest.fn(),
});

const createClientMock = () => {
  let handlers: Parameters<ApeXOmniClient['connectMarketStream']>[0] | null = null;
  const close = jest.fn();

  const client: ApeXOmniClient = {
    getMarketSnapshot: jest.fn(),
    getRecentCandles: jest.fn(),
    connectMarketStream: jest.fn((options) => {
      handlers = options;
      return {
        close,
      };
    }),
  };

  return { client, close, getHandlers: () => handlers };
};

describe('marketStreamPlugin', () => {
  it('subscribes to ApeX Omni stream and forwards ticks to the ring buffer', async () => {
    const app = fastify({ logger: false });
    const ringBuffer = createRingBufferMock();
    const { client, close, getHandlers } = createClientMock();

    const observability: Observability = {
      incrementCounter: jest.fn(),
      recordLatency: jest.fn(),
      recordAvailability: jest.fn(),
      snapshot: jest.fn(),
    };
    app.decorate('observability', observability);

    await app.register(marketStreamPlugin, {
      client,
      ringBuffer,
      symbols: ['BTC-USDT', 'ETH-USDT'],
    });
    await app.ready();

    expect(client.connectMarketStream).toHaveBeenCalledWith(
      expect.objectContaining({
        symbols: ['BTC-USDT', 'ETH-USDT'],
      }),
    );

    const handlers = getHandlers();
    expect(handlers).toBeTruthy();

    handlers?.onOpen?.();
    expect(observability.incrementCounter).toHaveBeenCalledWith('market_stream_connections_total');

    const payload = JSON.stringify({
      topic: 'instrumentInfo.H.BTCUSDT',
      data: {
        symbol: 'BTCUSDT',
        lastPrice: '100.50',
        bid: '100.10',
        ask: '100.90',
        atrMultiplier: '1.6',
        serverTimestamp: 1_700_000_000_000,
      },
    });
    handlers?.onMessage?.(payload);

    expect(ringBuffer.ingest).toHaveBeenCalledWith('BTC-USDT', {
      price: 100.5,
      bid: 100.1,
      ask: 100.9,
      atrMultiplier: '1.6',
      timestamp: 1_700_000_000_000,
    });

    handlers?.onError?.(new Error('ws failure'));
    expect(observability.incrementCounter).toHaveBeenCalledWith('market_stream_errors_total');

    handlers?.onClose?.(1006, Buffer.from('test'));
    expect(observability.incrementCounter).toHaveBeenCalledWith('market_stream_disconnects_total', {
      code: 1006,
    });

    await app.close();
    expect(close).toHaveBeenCalled();
  });
});
