import type {
  IndicatorSnapshot,
} from '@dedok/indicators';

import {
  DEFAULT_TECHNICAL_STRATEGY_CONFIG,
  type TechnicalStrategyConfig,
} from './config.js';
import type {
  StrategyRuleResult,
  StrategySignalResult,
  TradingSignal,
} from './contracts.js';
import {
  StrategyInputError,
} from './errors.js';

export type StrategyClock =
  () => Date;

export class TechnicalStrategy {
  public constructor(
    private readonly config:
      TechnicalStrategyConfig =
        DEFAULT_TECHNICAL_STRATEGY_CONFIG,
    private readonly clock:
      StrategyClock =
        () => new Date(),
  ) {
    validateConfig(config);
  }

  public evaluate(
    snapshot: IndicatorSnapshot,
  ): StrategySignalResult {
    const rules = [
      evaluatePriceVsSma(
        snapshot,
        this.config,
      ),
      evaluateSmaTrend(
        snapshot,
        this.config,
      ),
      evaluateEmaTrend(
        snapshot,
        this.config,
      ),
      evaluateRsi(
        snapshot,
        this.config,
      ),
      evaluateMacd(snapshot),
      evaluateBollingerBands(
        snapshot,
      ),
    ];

    const bullishScore =
      sumScores(
        rules,
        'BULLISH',
      );

    const bearishScore =
      sumScores(
        rules,
        'BEARISH',
      );

    const confidence =
      calculateConfidence(
        bullishScore,
        bearishScore,
      );

    const signal =
      determineSignal(
        bullishScore,
        bearishScore,
        this.config,
      );

    const reasons = rules
      .filter(
        (rule) =>
          rule.direction !==
          'NEUTRAL',
      )
      .map(
        (rule) =>
          rule.reason,
      );

    return {
      signal,
      confidence,
      bullishScore,
      bearishScore,
      evaluatedAt:
        this.clock(),
      candleCloseTime:
        snapshot.candleCloseTime,
      rules,
      reasons,
    };
  }
}

function evaluatePriceVsSma(
  snapshot: IndicatorSnapshot,
  config:
    TechnicalStrategyConfig,
): StrategyRuleResult {
  const slowSma =
    snapshot.sma[
      String(
        config.smaSlowPeriod,
      )
    ];

  if (slowSma == null) {
    return neutralRule(
      'price-vs-sma',
      'Price versus slow SMA',
      'Slow SMA is unavailable',
    );
  }

  if (snapshot.close > slowSma) {
    return {
      id: 'price-vs-sma',
      label:
        'Price versus slow SMA',
      direction: 'BULLISH',
      score: 20,
      reason:
        `Close ${snapshot.close} is above SMA ${config.smaSlowPeriod} at ${slowSma}`,
    };
  }

  if (snapshot.close < slowSma) {
    return {
      id: 'price-vs-sma',
      label:
        'Price versus slow SMA',
      direction: 'BEARISH',
      score: 20,
      reason:
        `Close ${snapshot.close} is below SMA ${config.smaSlowPeriod} at ${slowSma}`,
    };
  }

  return neutralRule(
    'price-vs-sma',
    'Price versus slow SMA',
    'Close equals the slow SMA',
  );
}

function evaluateSmaTrend(
  snapshot: IndicatorSnapshot,
  config:
    TechnicalStrategyConfig,
): StrategyRuleResult {
  const fast =
    snapshot.sma[
      String(
        config.smaFastPeriod,
      )
    ];

  const slow =
    snapshot.sma[
      String(
        config.smaSlowPeriod,
      )
    ];

  if (
    fast == null ||
    slow == null
  ) {
    return neutralRule(
      'sma-trend',
      'SMA trend',
      'SMA trend data is unavailable',
    );
  }

  if (fast > slow) {
    return {
      id: 'sma-trend',
      label: 'SMA trend',
      direction: 'BULLISH',
      score: 20,
      reason:
        `SMA ${config.smaFastPeriod} is above SMA ${config.smaSlowPeriod}`,
    };
  }

  if (fast < slow) {
    return {
      id: 'sma-trend',
      label: 'SMA trend',
      direction: 'BEARISH',
      score: 20,
      reason:
        `SMA ${config.smaFastPeriod} is below SMA ${config.smaSlowPeriod}`,
    };
  }

  return neutralRule(
    'sma-trend',
    'SMA trend',
    'Fast and slow SMA are equal',
  );
}

function evaluateEmaTrend(
  snapshot: IndicatorSnapshot,
  config:
    TechnicalStrategyConfig,
): StrategyRuleResult {
  const fast =
    snapshot.ema[
      String(
        config.emaFastPeriod,
      )
    ];

  const slow =
    snapshot.ema[
      String(
        config.emaSlowPeriod,
      )
    ];

  if (
    fast == null ||
    slow == null
  ) {
    return neutralRule(
      'ema-trend',
      'EMA trend',
      'EMA trend data is unavailable',
    );
  }

  if (fast > slow) {
    return {
      id: 'ema-trend',
      label: 'EMA trend',
      direction: 'BULLISH',
      score: 20,
      reason:
        `EMA ${config.emaFastPeriod} is above EMA ${config.emaSlowPeriod}`,
    };
  }

  if (fast < slow) {
    return {
      id: 'ema-trend',
      label: 'EMA trend',
      direction: 'BEARISH',
      score: 20,
      reason:
        `EMA ${config.emaFastPeriod} is below EMA ${config.emaSlowPeriod}`,
    };
  }

  return neutralRule(
    'ema-trend',
    'EMA trend',
    'Fast and slow EMA are equal',
  );
}

function evaluateRsi(
  snapshot: IndicatorSnapshot,
  config:
    TechnicalStrategyConfig,
): StrategyRuleResult {
  const rsi =
    snapshot.rsi[
      String(
        config.rsiPeriod,
      )
    ];

  if (rsi == null) {
    return neutralRule(
      'rsi',
      'RSI momentum',
      'RSI is unavailable',
    );
  }

  if (rsi >= 55 && rsi < 70) {
    return {
      id: 'rsi',
      label: 'RSI momentum',
      direction: 'BULLISH',
      score: 15,
      reason:
        `RSI ${config.rsiPeriod} is bullish at ${rsi}`,
    };
  }

  if (rsi <= 45 && rsi > 30) {
    return {
      id: 'rsi',
      label: 'RSI momentum',
      direction: 'BEARISH',
      score: 15,
      reason:
        `RSI ${config.rsiPeriod} is bearish at ${rsi}`,
    };
  }

  return neutralRule(
    'rsi',
    'RSI momentum',
    `RSI ${config.rsiPeriod} is neutral or extreme at ${rsi}`,
  );
}

function evaluateMacd(
  snapshot: IndicatorSnapshot,
): StrategyRuleResult {
  const {
    macd,
    signal,
    histogram,
  } = snapshot.macd;

  if (
    macd == null ||
    signal == null ||
    histogram == null
  ) {
    return neutralRule(
      'macd',
      'MACD momentum',
      'MACD is unavailable',
    );
  }

  if (
    macd > signal &&
    histogram > 0
  ) {
    return {
      id: 'macd',
      label: 'MACD momentum',
      direction: 'BULLISH',
      score: 15,
      reason:
        'MACD is above its signal line with a positive histogram',
    };
  }

  if (
    macd < signal &&
    histogram < 0
  ) {
    return {
      id: 'macd',
      label: 'MACD momentum',
      direction: 'BEARISH',
      score: 15,
      reason:
        'MACD is below its signal line with a negative histogram',
    };
  }

  return neutralRule(
    'macd',
    'MACD momentum',
    'MACD does not confirm a direction',
  );
}

function evaluateBollingerBands(
  snapshot: IndicatorSnapshot,
): StrategyRuleResult {
  const {
    middle,
    upper,
    lower,
  } = snapshot.bollingerBands;

  if (
    middle == null ||
    upper == null ||
    lower == null
  ) {
    return neutralRule(
      'bollinger-position',
      'Bollinger position',
      'Bollinger Bands are unavailable',
    );
  }

  if (
    snapshot.close > middle &&
    snapshot.close < upper
  ) {
    return {
      id: 'bollinger-position',
      label:
        'Bollinger position',
      direction: 'BULLISH',
      score: 10,
      reason:
        'Close is above the Bollinger middle band',
    };
  }

  if (
    snapshot.close < middle &&
    snapshot.close > lower
  ) {
    return {
      id: 'bollinger-position',
      label:
        'Bollinger position',
      direction: 'BEARISH',
      score: 10,
      reason:
        'Close is below the Bollinger middle band',
    };
  }

  return neutralRule(
    'bollinger-position',
    'Bollinger position',
    'Close is outside or equal to the Bollinger reference bands',
  );
}

function neutralRule(
  id: string,
  label: string,
  reason: string,
): StrategyRuleResult {
  return {
    id,
    label,
    direction: 'NEUTRAL',
    score: 0,
    reason,
  };
}

function sumScores(
  rules:
    readonly StrategyRuleResult[],
  direction:
    'BULLISH' | 'BEARISH',
): number {
  return rules.reduce(
    (total, rule) =>
      rule.direction ===
      direction
        ? total + rule.score
        : total,
    0,
  );
}

function calculateConfidence(
  bullishScore: number,
  bearishScore: number,
): number {
  const dominantScore =
    Math.max(
      bullishScore,
      bearishScore,
    );

  const opposingScore =
    Math.min(
      bullishScore,
      bearishScore,
    );

  return Math.max(
    0,
    Math.min(
      100,
      dominantScore -
        opposingScore,
    ),
  );
}

function determineSignal(
  bullishScore: number,
  bearishScore: number,
  config:
    TechnicalStrategyConfig,
): TradingSignal {
  if (
    bullishScore >=
      config.longThreshold &&
    bullishScore >
      bearishScore
  ) {
    return 'LONG';
  }

  if (
    bearishScore >=
      config.shortThreshold &&
    bearishScore >
      bullishScore
  ) {
    return 'SHORT';
  }

  return 'NEUTRAL';
}

function validateConfig(
  config:
    TechnicalStrategyConfig,
): void {
  const periods = [
    config.smaFastPeriod,
    config.smaSlowPeriod,
    config.emaFastPeriod,
    config.emaSlowPeriod,
    config.rsiPeriod,
    config.atrPeriod,
  ];

  if (
    periods.some(
      (period) =>
        !Number.isInteger(
          period,
        ) ||
        period < 1,
    )
  ) {
    throw new StrategyInputError(
      'Strategy periods must be positive integers',
    );
  }

  if (
    config.smaFastPeriod >=
    config.smaSlowPeriod
  ) {
    throw new StrategyInputError(
      'Fast SMA period must be less than slow SMA period',
    );
  }

  if (
    config.emaFastPeriod >=
    config.emaSlowPeriod
  ) {
    throw new StrategyInputError(
      'Fast EMA period must be less than slow EMA period',
    );
  }

  if (
    config.longThreshold < 0 ||
    config.longThreshold > 100 ||
    config.shortThreshold < 0 ||
    config.shortThreshold > 100
  ) {
    throw new StrategyInputError(
      'Strategy thresholds must be between 0 and 100',
    );
  }
}