import type {
  SupportedSymbol,
  SupportedTimeframe,
} from '@dedok/shared';

import type {
  BinanceKline,
  BinanceKlineRequest,
  BinanceRestClientOptions,
} from './binance-types.js';

const MAX_BINANCE_KLINE_LIMIT = 1000;
const BASE_RETRY_DELAY_MS = 250;
const MAX_RETRY_DELAY_MS = 5_000;

export class BinanceHttpError extends Error {
  public constructor(
    message: string,
    public readonly statusCode?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'BinanceHttpError';
  }
}

export class BinancePayloadError extends Error {
  public constructor(
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'BinancePayloadError';
  }
}

function isNumericString(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    return false;
  }

  return Number.isFinite(Number(value));
}

function isBinanceKline(value: unknown): value is BinanceKline {
  if (!Array.isArray(value) || value.length < 12) {
    return false;
  }

  return (
    typeof value[0] === 'number' &&
    Number.isFinite(value[0]) &&
    isNumericString(value[1]) &&
    isNumericString(value[2]) &&
    isNumericString(value[3]) &&
    isNumericString(value[4]) &&
    isNumericString(value[5]) &&
    typeof value[6] === 'number' &&
    Number.isFinite(value[6]) &&
    isNumericString(value[7]) &&
    typeof value[8] === 'number' &&
    Number.isInteger(value[8]) &&
    value[8] >= 0 &&
    isNumericString(value[9]) &&
    isNumericString(value[10]) &&
    typeof value[11] === 'string'
  );
}

function validateRequest(request: BinanceKlineRequest): void {
  if (
    !Number.isInteger(request.limit) ||
    request.limit < 1 ||
    request.limit > MAX_BINANCE_KLINE_LIMIT
  ) {
    throw new RangeError(
      `Binance kline limit must be an integer between 1 and ${MAX_BINANCE_KLINE_LIMIT}`,
    );
  }

  if (
    request.startTime !== undefined &&
    (!Number.isInteger(request.startTime) ||
      request.startTime < 0)
  ) {
    throw new RangeError(
      'Binance startTime must be a non-negative integer',
    );
  }

  if (
    request.endTime !== undefined &&
    (!Number.isInteger(request.endTime) ||
      request.endTime < 0)
  ) {
    throw new RangeError(
      'Binance endTime must be a non-negative integer',
    );
  }

  if (
    request.startTime !== undefined &&
    request.endTime !== undefined &&
    request.endTime < request.startTime
  ) {
    throw new RangeError(
      'Binance endTime must not be before startTime',
    );
  }
}

function shouldRetry(error: unknown): boolean {
  if (error instanceof BinancePayloadError) {
    return false;
  }

  if (error instanceof BinanceHttpError) {
    return (
      error.statusCode === undefined ||
      error.statusCode === 408 ||
      error.statusCode === 418 ||
      error.statusCode === 429 ||
      error.statusCode >= 500
    );
  }

  if (error instanceof DOMException) {
    return error.name === 'AbortError';
  }

  if (error instanceof TypeError) {
    return true;
  }

  return false;
}

function getRetryDelay(
  attempt: number,
  randomValue: number = Math.random(),
): number {
  const exponentialDelay =
    BASE_RETRY_DELAY_MS * 2 ** attempt;

  const jitter = Math.floor(randomValue * 100);

  return Math.min(
    exponentialDelay + jitter,
    MAX_RETRY_DELAY_MS,
  );
}

function defaultDelay(
  milliseconds: number,
): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export class BinanceRestClient {
  private readonly fetchImplementation: typeof fetch;

  private readonly retryDelayImplementation: (
    milliseconds: number,
  ) => Promise<void>;

  public constructor(
    private readonly options: BinanceRestClientOptions,
  ) {
    if (!options.baseUrl.trim()) {
      throw new TypeError(
        'Binance baseUrl must not be empty',
      );
    }

    if (
      !Number.isInteger(options.timeoutMs) ||
      options.timeoutMs < 1
    ) {
      throw new RangeError(
        'Binance timeoutMs must be a positive integer',
      );
    }

    if (
      !Number.isInteger(options.maxRetries) ||
      options.maxRetries < 0
    ) {
      throw new RangeError(
        'Binance maxRetries must be a non-negative integer',
      );
    }

    this.fetchImplementation =
      options.fetchImplementation ?? fetch;

    this.retryDelayImplementation =
      options.retryDelayImplementation ?? defaultDelay;
  }

  public async getKlines(
    request: BinanceKlineRequest,
  ): Promise<BinanceKline[]> {
    validateRequest(request);

    const url = this.buildKlineUrl(request);

    for (
      let attempt = 0;
      attempt <= this.options.maxRetries;
      attempt += 1
    ) {
      try {
        return await this.executeKlineRequest(url);
      } catch (error: unknown) {
        const exhausted =
          attempt >= this.options.maxRetries;

        if (exhausted || !shouldRetry(error)) {
          throw error;
        }

        const delayMs = getRetryDelay(attempt);

        await this.retryDelayImplementation(delayMs);
      }
    }

    throw new BinanceHttpError(
      'Binance request exhausted retries',
    );
  }

  private buildKlineUrl(
    request: BinanceKlineRequest,
  ): URL {
    const url = new URL(
      '/api/v3/klines',
      this.options.baseUrl,
    );

    url.searchParams.set('symbol', request.symbol);
    url.searchParams.set(
      'interval',
      request.interval,
    );
    url.searchParams.set(
      'limit',
      String(request.limit),
    );

    if (request.startTime !== undefined) {
      url.searchParams.set(
        'startTime',
        String(request.startTime),
      );
    }

    if (request.endTime !== undefined) {
      url.searchParams.set(
        'endTime',
        String(request.endTime),
      );
    }

    return url;
  }

  private async executeKlineRequest(
    url: URL,
  ): Promise<BinanceKline[]> {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, this.options.timeoutMs);

    try {
      const response = await this.fetchImplementation(
        url,
        {
          method: 'GET',
          headers: {
            accept: 'application/json',
            'user-agent':
              'dedok-trading-assistant/0.2.0',
          },
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new BinanceHttpError(
          `Binance returned HTTP ${response.status}`,
          response.status,
        );
      }

      const payload: unknown = await response.json();

      if (
        !Array.isArray(payload) ||
        !payload.every(isBinanceKline)
      ) {
        throw new BinancePayloadError(
          'Binance returned an invalid kline payload',
        );
      }

      return payload;
    } catch (error: unknown) {
      if (
        error instanceof BinanceHttpError ||
        error instanceof BinancePayloadError
      ) {
        throw error;
      }

      if (
        error instanceof DOMException &&
        error.name === 'AbortError'
      ) {
        throw new BinanceHttpError(
          `Binance request timed out after ${this.options.timeoutMs}ms`,
          408,
          { cause: error },
        );
      }

      throw new BinanceHttpError(
        'Binance request failed',
        undefined,
        {
          cause:
            error instanceof Error
              ? error
              : undefined,
        },
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function buildKlineRequest(
  symbol: SupportedSymbol,
  interval: SupportedTimeframe,
  limit: number,
): BinanceKlineRequest {
  return {
    symbol,
    interval,
    limit,
  };
}