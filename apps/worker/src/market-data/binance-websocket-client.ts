import WebSocket, {
  type RawData,
} from 'ws';

import type {
  BinanceWebSocketKlineEvent,
  BinanceWebSocketParseIgnored,
} from './binance-websocket-types.js';
import {
  parseBinanceWebSocketMessage,
} from './binance-websocket-parser.js';

const WEB_SOCKET_OPEN_STATE = 1;
const WEB_SOCKET_CONNECTING_STATE = 0;

export type BinanceWebSocketStatus =
  | 'IDLE'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'STOPPED';

export interface BinanceWebSocketLogger {
  info(
    bindings: Record<string, unknown>,
    message: string,
  ): void;

  warn(
    bindings: Record<string, unknown>,
    message: string,
  ): void;

  error(
    bindings: Record<string, unknown>,
    message: string,
  ): void;

  debug?(
    bindings: Record<string, unknown>,
    message: string,
  ): void;
}

export interface WebSocketLike {
  readonly readyState: number;

  on(
    event: 'open',
    listener: () => void,
  ): this;

  on(
    event: 'message',
    listener: (data: RawData) => void,
  ): this;

  on(
    event: 'close',
    listener: (
      code: number,
      reason: Buffer,
    ) => void,
  ): this;

  on(
    event: 'error',
    listener: (error: Error) => void,
  ): this;

  on(
    event: 'pong',
    listener: () => void,
  ): this;

  ping(): void;

  close(
    code?: number,
    reason?: string,
  ): void;

  terminate(): void;
}

export type WebSocketFactory = (
  url: string,
) => WebSocketLike;

export interface BinanceWebSocketClientOptions {
  url: string;
  reconnectBaseDelayMs: number;
  reconnectMaxDelayMs: number;
  heartbeatIntervalMs: number;
  onEvent(
    event: BinanceWebSocketKlineEvent,
  ): void | Promise<void>;
  onIgnoredMessage?(
    result: BinanceWebSocketParseIgnored,
  ): void;
  onStatusChange?(
    status: BinanceWebSocketStatus,
  ): void;
  webSocketFactory?: WebSocketFactory;
  random?: () => number;
}

export interface BinanceWebSocketHealth {
  status: BinanceWebSocketStatus;
  connected: boolean;
  reconnectAttempt: number;
  lastMessageAt: Date | null;
  lastPongAt: Date | null;
  awaitingPong: boolean;
}

export function calculateReconnectDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  randomValue: number = Math.random(),
): number {
  if (!Number.isInteger(attempt) || attempt < 0) {
    throw new RangeError(
      'Reconnect attempt must be a non-negative integer',
    );
  }

  if (
    !Number.isInteger(baseDelayMs) ||
    baseDelayMs < 1
  ) {
    throw new RangeError(
      'Reconnect base delay must be a positive integer',
    );
  }

  if (
    !Number.isInteger(maxDelayMs) ||
    maxDelayMs < baseDelayMs
  ) {
    throw new RangeError(
      'Reconnect max delay must be greater than or equal to the base delay',
    );
  }

  const normalizedRandom = Math.min(
    Math.max(randomValue, 0),
    1,
  );

  const exponentialDelay =
    baseDelayMs * 2 ** attempt;

  const cappedDelay = Math.min(
    exponentialDelay,
    maxDelayMs,
  );

  const jitterRange = Math.max(
    Math.floor(cappedDelay * 0.2),
    1,
  );

  const jitter = Math.floor(
    normalizedRandom * jitterRange,
  );

  return Math.min(
    cappedDelay + jitter,
    maxDelayMs,
  );
}

function defaultWebSocketFactory(
  url: string,
): WebSocketLike {
  return new WebSocket(url);
}

function normalizeRawData(
  data: RawData,
): Buffer {
  if (Buffer.isBuffer(data)) {
    return data;
  }

  if (Array.isArray(data)) {
    return Buffer.concat(data);
  }

  return Buffer.from(data);
}

export class BinanceWebSocketClient {
  private socket: WebSocketLike | undefined;

  private reconnectTimer:
    | NodeJS.Timeout
    | undefined;

  private heartbeatTimer:
    | NodeJS.Timeout
    | undefined;

  private status:
    BinanceWebSocketStatus = 'IDLE';

  private reconnectAttempt = 0;

  private lastMessageAt: Date | null = null;

  private lastPongAt: Date | null = null;

  private awaitingPong = false;

  private stopped = true;

  private reconnectScheduled = false;

  private readonly webSocketFactory:
    WebSocketFactory;

  private readonly random: () => number;

  public constructor(
    private readonly logger:
      BinanceWebSocketLogger,
    private readonly options:
      BinanceWebSocketClientOptions,
  ) {
    const parsedUrl = new URL(options.url);

    if (
      parsedUrl.protocol !== 'ws:' &&
      parsedUrl.protocol !== 'wss:'
    ) {
      throw new TypeError(
        'Binance WebSocket URL must use ws or wss protocol',
      );
    }

    if (
      !Number.isInteger(
        options.reconnectBaseDelayMs,
      ) ||
      options.reconnectBaseDelayMs < 1
    ) {
      throw new RangeError(
        'WebSocket reconnect base delay must be a positive integer',
      );
    }

    if (
      !Number.isInteger(
        options.reconnectMaxDelayMs,
      ) ||
      options.reconnectMaxDelayMs <
        options.reconnectBaseDelayMs
    ) {
      throw new RangeError(
        'WebSocket reconnect max delay must be greater than or equal to the base delay',
      );
    }

    if (
      !Number.isInteger(
        options.heartbeatIntervalMs,
      ) ||
      options.heartbeatIntervalMs < 1_000
    ) {
      throw new RangeError(
        'WebSocket heartbeat interval must be at least 1000ms',
      );
    }

    this.webSocketFactory =
      options.webSocketFactory ??
      defaultWebSocketFactory;

    this.random =
      options.random ?? Math.random;
  }

  public start(): void {
    if (!this.stopped) {
      this.logger.warn(
        {
          status: this.status,
        },
        'Binance WebSocket client is already started',
      );

      return;
    }

    this.stopped = false;
    this.reconnectAttempt = 0;
    this.connect();
  }

  public stop(): void {
    if (this.stopped) {
      return;
    }

    this.stopped = true;
    this.clearReconnectTimer();
    this.clearHeartbeatTimer();

    this.awaitingPong = false;
    this.reconnectScheduled = false;

    const socket = this.socket;
    this.socket = undefined;

    if (
      socket !== undefined &&
      (socket.readyState ===
        WEB_SOCKET_OPEN_STATE ||
        socket.readyState ===
          WEB_SOCKET_CONNECTING_STATE)
    ) {
      socket.close(
        1000,
        'Dedok worker shutdown',
      );
    }

    this.setStatus('STOPPED');

    this.logger.info(
      {},
      'Binance WebSocket client stopped',
    );
  }

  public getHealth():
    BinanceWebSocketHealth {
    return {
      status: this.status,
      connected:
        this.status === 'CONNECTED',
      reconnectAttempt:
        this.reconnectAttempt,
      lastMessageAt: this.lastMessageAt,
      lastPongAt: this.lastPongAt,
      awaitingPong: this.awaitingPong,
    };
  }

  private connect(): void {
    if (this.stopped) {
      return;
    }

    this.clearReconnectTimer();
    this.reconnectScheduled = false;

    this.setStatus(
      this.reconnectAttempt === 0
        ? 'CONNECTING'
        : 'RECONNECTING',
    );

    this.logger.info(
      {
        url: this.options.url,
        reconnectAttempt:
          this.reconnectAttempt,
      },
      'Connecting Binance WebSocket',
    );

    let socket: WebSocketLike;

    try {
      socket = this.webSocketFactory(
        this.options.url,
      );
    } catch (error: unknown) {
      this.logger.error(
        {
          error: this.serializeError(error),
        },
        'Failed to create Binance WebSocket',
      );

      this.scheduleReconnect();

      return;
    }

    this.socket = socket;

    socket.on('open', () => {
      this.handleOpen(socket);
    });

    socket.on('message', (data) => {
      this.handleMessage(socket, data);
    });

    socket.on('pong', () => {
      this.handlePong(socket);
    });

    socket.on(
      'close',
      (code, reason) => {
        this.handleClose(
          socket,
          code,
          reason,
        );
      },
    );

    socket.on('error', (error) => {
      this.handleError(socket, error);
    });
  }

  private handleOpen(
    socket: WebSocketLike,
  ): void {
    if (
      this.stopped ||
      socket !== this.socket
    ) {
      return;
    }

    this.reconnectAttempt = 0;
    this.awaitingPong = false;
    this.lastPongAt = new Date();

    this.setStatus('CONNECTED');
    this.startHeartbeat();

    this.logger.info(
      {},
      'Binance WebSocket connected',
    );
  }

  private handleMessage(
    socket: WebSocketLike,
    data: RawData,
  ): void {
    if (
      this.stopped ||
      socket !== this.socket
    ) {
      return;
    }

    this.lastMessageAt = new Date();

    const result =
      parseBinanceWebSocketMessage(
        normalizeRawData(data),
      );

    if (!result.success) {
      this.options.onIgnoredMessage?.(
        result,
      );

      this.logger.debug?.(
        {
          reason: result.reason,
        },
        'Binance WebSocket message ignored',
      );

      return;
    }

    try {
      const handlerResult =
        this.options.onEvent(
          result.event,
        );

      if (
        handlerResult instanceof Promise
      ) {
        void handlerResult.catch(
          (error: unknown) => {
            this.logger.error(
              {
                stream:
                  result.event.stream,
                error:
                  this.serializeError(error),
              },
              'Binance WebSocket event handler failed',
            );
          },
        );
      }
    } catch (error: unknown) {
      this.logger.error(
        {
          stream: result.event.stream,
          error: this.serializeError(error),
        },
        'Binance WebSocket event handler failed',
      );
    }
  }

  private handlePong(
    socket: WebSocketLike,
  ): void {
    if (
      this.stopped ||
      socket !== this.socket
    ) {
      return;
    }

    this.awaitingPong = false;
    this.lastPongAt = new Date();
  }

  private handleClose(
    socket: WebSocketLike,
    code: number,
    reason: Buffer,
  ): void {
    if (socket !== this.socket) {
      return;
    }

    this.socket = undefined;
    this.clearHeartbeatTimer();
    this.awaitingPong = false;

    this.logger.warn(
      {
        code,
        reason: reason.toString('utf8'),
        stopped: this.stopped,
      },
      'Binance WebSocket disconnected',
    );

    if (this.stopped) {
      return;
    }

    this.scheduleReconnect();
  }

  private handleError(
    socket: WebSocketLike,
    error: Error,
  ): void {
    if (socket !== this.socket) {
      return;
    }

    this.logger.error(
      {
        error: this.serializeError(error),
      },
      'Binance WebSocket error',
    );
  }

  private startHeartbeat(): void {
    this.clearHeartbeatTimer();

    this.heartbeatTimer = setInterval(
      () => {
        this.runHeartbeat();
      },
      this.options.heartbeatIntervalMs,
    );
  }

  private runHeartbeat(): void {
    const socket = this.socket;

    if (
      this.stopped ||
      socket === undefined ||
      socket.readyState !==
        WEB_SOCKET_OPEN_STATE
    ) {
      return;
    }

    if (this.awaitingPong) {
      this.logger.warn(
        {
          lastPongAt:
            this.lastPongAt?.toISOString() ??
            null,
        },
        'Binance WebSocket pong timeout',
      );

      socket.terminate();

      return;
    }

    this.awaitingPong = true;

    try {
      socket.ping();
    } catch (error: unknown) {
      this.logger.error(
        {
          error: this.serializeError(error),
        },
        'Failed to ping Binance WebSocket',
      );

      socket.terminate();
    }
  }

  private scheduleReconnect(): void {
    if (
      this.stopped ||
      this.reconnectScheduled
    ) {
      return;
    }

    this.reconnectScheduled = true;

    const delayMs =
      calculateReconnectDelay(
        this.reconnectAttempt,
        this.options
          .reconnectBaseDelayMs,
        this.options
          .reconnectMaxDelayMs,
        this.random(),
      );

    this.reconnectAttempt += 1;
    this.setStatus('RECONNECTING');

    this.logger.warn(
      {
        delayMs,
        reconnectAttempt:
          this.reconnectAttempt,
      },
      'Binance WebSocket reconnect scheduled',
    );

    this.reconnectTimer = setTimeout(
      () => {
        this.reconnectTimer = undefined;
        this.reconnectScheduled = false;
        this.connect();
      },
      delayMs,
    );
  }

  private clearReconnectTimer(): void {
    if (
      this.reconnectTimer !== undefined
    ) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private clearHeartbeatTimer(): void {
    if (
      this.heartbeatTimer !== undefined
    ) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private setStatus(
    status: BinanceWebSocketStatus,
  ): void {
    if (this.status === status) {
      return;
    }

    this.status = status;
    this.options.onStatusChange?.(
      status,
    );
  }

  private serializeError(
    error: unknown,
  ): Record<string, unknown> {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
      };
    }

    return {
      message: 'Unknown error',
    };
  }
}