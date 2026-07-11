import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  BinanceHttpError,
  BinancePayloadError,
  BinanceRestClient,
} from '../src/market-data/binance-rest-client.js';

const validPayload = [
  [
    1_700_000_000_000,
    '100',
    '110',
    '90',
    '105',
    '12.5',
    1_700_003_599_999,
    '1312.5',
    100,
    '6.1',
    '640.5',
    '0',
  ],
];

describe('BinanceRestClient', () => {
  it('returns validated klines', async () => {
    const fetchImplementation =
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify(validPayload),
          {
            status: 200,
            headers: {
              'content-type':
                'application/json',
            },
          },
        ),
      );

    const client = new BinanceRestClient({
      baseUrl: 'https://api.binance.test',
      timeoutMs: 1_000,
      maxRetries: 0,
      fetchImplementation,
    });

    const result = await client.getKlines({
      symbol: 'BTCUSDT',
      interval: '1h',
      limit: 300,
    });

    expect(result).toHaveLength(1);
    expect(fetchImplementation).toHaveBeenCalledOnce();

    const calledUrl = fetchImplementation.mock
      .calls[0]?.[0];

    expect(String(calledUrl)).toContain(
      '/api/v3/klines',
    );
    expect(String(calledUrl)).toContain(
      'symbol=BTCUSDT',
    );
    expect(String(calledUrl)).toContain(
      'interval=1h',
    );
    expect(String(calledUrl)).toContain(
      'limit=300',
    );
  });

  it('includes optional time range parameters', async () => {
    const fetchImplementation =
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify(validPayload),
          { status: 200 },
        ),
      );

    const client = new BinanceRestClient({
      baseUrl: 'https://api.binance.test',
      timeoutMs: 1_000,
      maxRetries: 0,
      fetchImplementation,
    });

    await client.getKlines({
      symbol: 'ETHUSDT',
      interval: '15m',
      limit: 100,
      startTime: 1_700_000_000_000,
      endTime: 1_700_100_000_000,
    });

    const calledUrl = fetchImplementation.mock
      .calls[0]?.[0];

    expect(String(calledUrl)).toContain(
      'startTime=1700000000000',
    );
    expect(String(calledUrl)).toContain(
      'endTime=1700100000000',
    );
  });

  it('rejects malformed responses without retry', async () => {
    const fetchImplementation =
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            invalid: true,
          }),
          { status: 200 },
        ),
      );

    const retryDelayImplementation = vi.fn(
      async () => undefined,
    );

    const client = new BinanceRestClient({
      baseUrl: 'https://api.binance.test',
      timeoutMs: 1_000,
      maxRetries: 3,
      fetchImplementation,
      retryDelayImplementation,
    });

    await expect(
      client.getKlines({
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 300,
      }),
    ).rejects.toBeInstanceOf(
      BinancePayloadError,
    );

    expect(fetchImplementation).toHaveBeenCalledOnce();
    expect(
      retryDelayImplementation,
    ).not.toHaveBeenCalled();
  });

  it('does not retry an HTTP 400 response', async () => {
    const fetchImplementation =
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: -1100,
            msg: 'Bad request',
          }),
          { status: 400 },
        ),
      );

    const retryDelayImplementation = vi.fn(
      async () => undefined,
    );

    const client = new BinanceRestClient({
      baseUrl: 'https://api.binance.test',
      timeoutMs: 1_000,
      maxRetries: 3,
      fetchImplementation,
      retryDelayImplementation,
    });

    await expect(
      client.getKlines({
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 300,
      }),
    ).rejects.toMatchObject({
      name: 'BinanceHttpError',
      statusCode: 400,
    });

    expect(fetchImplementation).toHaveBeenCalledOnce();
    expect(
      retryDelayImplementation,
    ).not.toHaveBeenCalled();
  });

  it('retries an HTTP 500 response', async () => {
    const fetchImplementation =
      vi.fn<typeof fetch>()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              msg: 'Internal error',
            }),
            { status: 500 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify(validPayload),
            { status: 200 },
          ),
        );

    const retryDelayImplementation = vi.fn(
      async () => undefined,
    );

    const client = new BinanceRestClient({
      baseUrl: 'https://api.binance.test',
      timeoutMs: 1_000,
      maxRetries: 1,
      fetchImplementation,
      retryDelayImplementation,
    });

    const result = await client.getKlines({
      symbol: 'BTCUSDT',
      interval: '1h',
      limit: 300,
    });

    expect(result).toHaveLength(1);
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    expect(
      retryDelayImplementation,
    ).toHaveBeenCalledOnce();
  });

  it('rejects an invalid limit before making a request', async () => {
    const fetchImplementation =
      vi.fn<typeof fetch>();

    const client = new BinanceRestClient({
      baseUrl: 'https://api.binance.test',
      timeoutMs: 1_000,
      maxRetries: 0,
      fetchImplementation,
    });

    await expect(
      client.getKlines({
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 1001,
      }),
    ).rejects.toThrow(
      'Binance kline limit must be an integer between 1 and 1000',
    );

    expect(
      fetchImplementation,
    ).not.toHaveBeenCalled();
  });

  it('rejects an invalid time range', async () => {
    const fetchImplementation =
      vi.fn<typeof fetch>();

    const client = new BinanceRestClient({
      baseUrl: 'https://api.binance.test',
      timeoutMs: 1_000,
      maxRetries: 0,
      fetchImplementation,
    });

    await expect(
      client.getKlines({
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 100,
        startTime: 2000,
        endTime: 1000,
      }),
    ).rejects.toThrow(
      'Binance endTime must not be before startTime',
    );

    expect(
      fetchImplementation,
    ).not.toHaveBeenCalled();
  });

  it('wraps a network failure as BinanceHttpError', async () => {
    const fetchImplementation =
      vi.fn<typeof fetch>().mockRejectedValue(
        new TypeError('Network unavailable'),
      );

    const client = new BinanceRestClient({
      baseUrl: 'https://api.binance.test',
      timeoutMs: 1_000,
      maxRetries: 0,
      fetchImplementation,
    });

    await expect(
      client.getKlines({
        symbol: 'SOLUSDT',
        interval: '4h',
        limit: 100,
      }),
    ).rejects.toBeInstanceOf(
      BinanceHttpError,
    );
  });
});