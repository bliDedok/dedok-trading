import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  buildBinanceCombinedStreamUrl,
  buildBinanceKlineStreamName,
  parseBinanceWebSocketMessage,
} from '../src/market-data/binance-websocket-parser.js';

function createMessage(
  overrides: Record<string, unknown> = {},
): string {
  const payload = {
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
    ...overrides,
  };

  return JSON.stringify(payload);
}

describe('Binance WebSocket parser', () => {
  it('builds a kline stream name', () => {
    expect(
      buildBinanceKlineStreamName(
        'BTCUSDT',
        '1h',
      ),
    ).toBe('btcusdt@kline_1h');
  });

  it('builds one combined URL for all streams', () => {
    const url =
      buildBinanceCombinedStreamUrl(
        'wss://stream.binance.com:9443',
        ['BTCUSDT', 'ETHUSDT'],
        ['15m', '1h'],
      );

    expect(url.protocol).toBe('wss:');
    expect(url.pathname).toBe('/stream');

    expect(
      url.searchParams
        .get('streams')
        ?.split('/'),
    ).toEqual([
      'btcusdt@kline_15m',
      'btcusdt@kline_1h',
      'ethusdt@kline_15m',
      'ethusdt@kline_1h',
    ]);
  });

  it('normalizes a base URL ending with ws', () => {
    const url =
      buildBinanceCombinedStreamUrl(
        'wss://stream.binance.com:9443/ws',
        ['SOLUSDT'],
        ['4h'],
      );

    expect(url.pathname).toBe('/stream');
    expect(
      url.searchParams.get('streams'),
    ).toBe('solusdt@kline_4h');
  });

  it('rejects an empty symbol list', () => {
    expect(() =>
      buildBinanceCombinedStreamUrl(
        'wss://stream.binance.com:9443',
        [],
        ['1h'],
      ),
    ).toThrow(
      'At least one Binance WebSocket symbol is required',
    );
  });

  it('rejects an empty timeframe list', () => {
    expect(() =>
      buildBinanceCombinedStreamUrl(
        'wss://stream.binance.com:9443',
        ['BTCUSDT'],
        [],
      ),
    ).toThrow(
      'At least one Binance WebSocket timeframe is required',
    );
  });

  it('parses a valid closed kline event', () => {
    const result =
      parseBinanceWebSocketMessage(
        createMessage(),
      );

    expect(result.success).toBe(true);

    if (!result.success) {
      throw new Error(
        'Expected a successful parse result',
      );
    }

    expect(result.event.symbol).toBe(
      'BTCUSDT',
    );
    expect(result.event.kline.interval).toBe(
      '1h',
    );
    expect(result.event.kline.isClosed).toBe(
      true,
    );
    expect(result.event.kline.open).toBe(
      '100',
    );
    expect(result.event.kline.close).toBe(
      '105',
    );
    expect(result.event.kline.tradeCount).toBe(
      101,
    );
  });

  it('parses a forming kline event', () => {
    const payload = JSON.parse(
      createMessage(),
    ) as {
      data: {
        k: {
          x: boolean;
        };
      };
    };

    payload.data.k.x = false;

    const result =
      parseBinanceWebSocketMessage(
        JSON.stringify(payload),
      );

    expect(result.success).toBe(true);

    if (!result.success) {
      throw new Error(
        'Expected a successful parse result',
      );
    }

    expect(result.event.kline.isClosed).toBe(
      false,
    );
  });

  it('accepts a Buffer message', () => {
    const result =
      parseBinanceWebSocketMessage(
        Buffer.from(createMessage()),
      );

    expect(result.success).toBe(true);
  });

  it('rejects invalid JSON', () => {
    expect(
      parseBinanceWebSocketMessage(
        'not-json',
      ),
    ).toEqual({
      success: false,
      reason: 'INVALID_JSON',
    });
  });

  it('rejects an invalid payload', () => {
    expect(
      parseBinanceWebSocketMessage(
        JSON.stringify({
          stream: 'btcusdt@kline_1h',
          data: {
            invalid: true,
          },
        }),
      ),
    ).toEqual({
      success: false,
      reason: 'INVALID_PAYLOAD',
    });
  });

  it('rejects an unsupported event type', () => {
    const payload = JSON.parse(
      createMessage(),
    ) as {
      data: {
        e: string;
      };
    };

    payload.data.e = 'trade';

    expect(
      parseBinanceWebSocketMessage(
        JSON.stringify(payload),
      ),
    ).toEqual({
      success: false,
      reason: 'UNSUPPORTED_EVENT',
    });
  });

  it('rejects an unsupported symbol', () => {
    const payload = JSON.parse(
      createMessage(),
    ) as {
      data: {
        s: string;
        k: {
          s: string;
        };
      };
    };

    payload.data.s = 'DOGEUSDT';
    payload.data.k.s = 'DOGEUSDT';

    expect(
      parseBinanceWebSocketMessage(
        JSON.stringify(payload),
      ),
    ).toEqual({
      success: false,
      reason: 'UNSUPPORTED_SYMBOL',
    });
  });

  it('rejects an unsupported timeframe', () => {
    const payload = JSON.parse(
      createMessage(),
    ) as {
      stream: string;
      data: {
        k: {
          i: string;
        };
      };
    };

    payload.stream =
      'btcusdt@kline_5m';
    payload.data.k.i = '5m';

    expect(
      parseBinanceWebSocketMessage(
        JSON.stringify(payload),
      ),
    ).toEqual({
      success: false,
      reason: 'UNSUPPORTED_TIMEFRAME',
    });
  });

  it('rejects a stream and payload mismatch', () => {
    const payload = JSON.parse(
      createMessage(),
    ) as {
      stream: string;
    };

    payload.stream =
      'ethusdt@kline_1h';

    expect(
      parseBinanceWebSocketMessage(
        JSON.stringify(payload),
      ),
    ).toEqual({
      success: false,
      reason: 'STREAM_MISMATCH',
    });
  });
});