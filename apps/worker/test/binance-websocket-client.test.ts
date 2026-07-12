import { EventEmitter } from 'node:events';

import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  BinanceWebSocketClient,
  calculateReconnectDelay,
  type BinanceWebSocketLogger,
  type WebSocketLike,
} from '../src/market-data/binance-websocket-client.js';

class FakeWebSocket
  extends EventEmitter
  implements WebSocketLike
{
  public readyState = 0;

  public readonly ping = vi.fn();

  public readonly close = vi.fn(
    (
      _code?: number,
      _reason?: string,
    ) => {
      this.readyState = 3;
    },
  );

  public readonly terminate = vi.fn(
    () => {
      this.readyState = 3;
    },
  );

  public open(): void {
    this.readyState = 1;
    this.emit('open');
  }

  public sendMessage(
    value: string,
  ): void {
    this.emit(
      'message',
      Buffer.from(value),
    );
  }

  public sendPong(): void {
    this.emit('pong');
  }

  public disconnect(
    code = 1006,
    reason = 'Disconnected',
  ): void {
    this.readyState = 3;

    this.emit(
      'close',
      code,
      Buffer.from(reason),
    );
  }

  public fail(
    error: Error,
  ): void {
    this.emit('error', error);
  }
}

function createLogger():
  BinanceWebSocketLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

function createKlineMessage(): string {
  return JSON.stringify({
    stream: 'btcusdt@kline_1h',
    data: {
      e: 'kline',
      E: 1_700_003_600_100,
      s: 'BTCUSDT',
      k: {
        t: 1_700_000_000_000,
        T: 1_700_003_599_999,
        s: 'BTCUSDT',
        i: '1h',
        f: 100,
        L: 200,
        o: '100',
        c: '105',
        h: '110',
        l: '90',
        v: '12.5',
        n: 101,
        x: true,
        q: '1312.5',
        V: '6.1',
        Q: '640.5',
      },
    },
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe(
  'calculateReconnectDelay',
  () => {
    it('uses exponential backoff', () => {
      expect(
        calculateReconnectDelay(
          0,
          1_000,
          30_000,
          0,
        ),
      ).toBe(1_000);

      expect(
        calculateReconnectDelay(
          1,
          1_000,
          30_000,
          0,
        ),
      ).toBe(2_000);

      expect(
        calculateReconnectDelay(
          2,
          1_000,
          30_000,
          0,
        ),
      ).toBe(4_000);
    });

    it('caps reconnect delay', () => {
      expect(
        calculateReconnectDelay(
          20,
          1_000,
          30_000,
          1,
        ),
      ).toBe(30_000);
    });
  },
);

describe(
  'BinanceWebSocketClient',
  () => {
    it('connects and forwards parsed events', () => {
      const socket =
        new FakeWebSocket();

      const onEvent = vi.fn();

      const client =
        new BinanceWebSocketClient(
          createLogger(),
          {
            url: 'wss://stream.binance.test/stream?streams=btcusdt@kline_1h',
            reconnectBaseDelayMs: 1_000,
            reconnectMaxDelayMs: 30_000,
            heartbeatIntervalMs: 10_000,
            onEvent,
            webSocketFactory:
              () => socket,
          },
        );

      client.start();
      socket.open();
      socket.sendMessage(
        createKlineMessage(),
      );

      expect(onEvent).toHaveBeenCalledOnce();

      expect(
        client.getHealth(),
      ).toMatchObject({
        status: 'CONNECTED',
        connected: true,
        reconnectAttempt: 0,
      });

      client.stop();
    });

    it('ignores invalid messages', () => {
      const socket =
        new FakeWebSocket();

      const onEvent = vi.fn();
      const onIgnoredMessage = vi.fn();

      const client =
        new BinanceWebSocketClient(
          createLogger(),
          {
            url: 'wss://stream.binance.test/stream',
            reconnectBaseDelayMs: 1_000,
            reconnectMaxDelayMs: 30_000,
            heartbeatIntervalMs: 10_000,
            onEvent,
            onIgnoredMessage,
            webSocketFactory:
              () => socket,
          },
        );

      client.start();
      socket.open();
      socket.sendMessage('invalid-json');

      expect(onEvent).not.toHaveBeenCalled();

      expect(
        onIgnoredMessage,
      ).toHaveBeenCalledWith({
        success: false,
        reason: 'INVALID_JSON',
      });

      client.stop();
    });

    it('reconnects after a disconnect', async () => {
      vi.useFakeTimers();

      const firstSocket =
        new FakeWebSocket();

      const secondSocket =
        new FakeWebSocket();

      const factory = vi
        .fn()
        .mockReturnValueOnce(firstSocket)
        .mockReturnValueOnce(secondSocket);

      const client =
        new BinanceWebSocketClient(
          createLogger(),
          {
            url: 'wss://stream.binance.test/stream',
            reconnectBaseDelayMs: 1_000,
            reconnectMaxDelayMs: 30_000,
            heartbeatIntervalMs: 10_000,
            onEvent: vi.fn(),
            webSocketFactory: factory,
            random: () => 0,
          },
        );

      client.start();
      firstSocket.open();
      firstSocket.disconnect();

      expect(
        client.getHealth().status,
      ).toBe('RECONNECTING');

      await vi.advanceTimersByTimeAsync(
        1_000,
      );

      expect(factory).toHaveBeenCalledTimes(
        2,
      );

      secondSocket.open();

      expect(
        client.getHealth().status,
      ).toBe('CONNECTED');

      client.stop();
    });

    it('does not reconnect after stop', async () => {
      vi.useFakeTimers();

      const socket =
        new FakeWebSocket();

      const factory = vi
        .fn()
        .mockReturnValue(socket);

      const client =
        new BinanceWebSocketClient(
          createLogger(),
          {
            url: 'wss://stream.binance.test/stream',
            reconnectBaseDelayMs: 1_000,
            reconnectMaxDelayMs: 30_000,
            heartbeatIntervalMs: 10_000,
            onEvent: vi.fn(),
            webSocketFactory: factory,
            random: () => 0,
          },
        );

      client.start();
      socket.open();
      socket.disconnect();

      client.stop();

      await vi.advanceTimersByTimeAsync(
        10_000,
      );

      expect(factory).toHaveBeenCalledOnce();

      expect(
        client.getHealth().status,
      ).toBe('STOPPED');
    });

    it('pings an open connection', async () => {
      vi.useFakeTimers();

      const socket =
        new FakeWebSocket();

      const client =
        new BinanceWebSocketClient(
          createLogger(),
          {
            url: 'wss://stream.binance.test/stream',
            reconnectBaseDelayMs: 1_000,
            reconnectMaxDelayMs: 30_000,
            heartbeatIntervalMs: 10_000,
            onEvent: vi.fn(),
            webSocketFactory:
              () => socket,
          },
        );

      client.start();
      socket.open();

      await vi.advanceTimersByTimeAsync(
        10_000,
      );

      expect(socket.ping).toHaveBeenCalledOnce();

      expect(
        client.getHealth().awaitingPong,
      ).toBe(true);

      socket.sendPong();

      expect(
        client.getHealth().awaitingPong,
      ).toBe(false);

      client.stop();
    });

    it('terminates a connection when pong is missing', async () => {
      vi.useFakeTimers();

      const socket =
        new FakeWebSocket();

      const client =
        new BinanceWebSocketClient(
          createLogger(),
          {
            url: 'wss://stream.binance.test/stream',
            reconnectBaseDelayMs: 1_000,
            reconnectMaxDelayMs: 30_000,
            heartbeatIntervalMs: 10_000,
            onEvent: vi.fn(),
            webSocketFactory:
              () => socket,
          },
        );

      client.start();
      socket.open();

      await vi.advanceTimersByTimeAsync(
        10_000,
      );

      expect(socket.ping).toHaveBeenCalledOnce();

      await vi.advanceTimersByTimeAsync(
        10_000,
      );

      expect(
        socket.terminate,
      ).toHaveBeenCalledOnce();

      client.stop();
    });

    it('closes the socket gracefully when stopped', () => {
      const socket =
        new FakeWebSocket();

      const client =
        new BinanceWebSocketClient(
          createLogger(),
          {
            url: 'wss://stream.binance.test/stream',
            reconnectBaseDelayMs: 1_000,
            reconnectMaxDelayMs: 30_000,
            heartbeatIntervalMs: 10_000,
            onEvent: vi.fn(),
            webSocketFactory:
              () => socket,
          },
        );

      client.start();
      socket.open();
      client.stop();

      expect(socket.close).toHaveBeenCalledWith(
        1000,
        'Dedok worker shutdown',
      );

      expect(
        client.getHealth().status,
      ).toBe('STOPPED');
    });
  },
);