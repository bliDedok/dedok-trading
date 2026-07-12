import type {
  IndicatorSnapshot,
} from '@dedok/indicators';

export type TradingSignal =
  | 'LONG'
  | 'SHORT'
  | 'NEUTRAL';

export type RuleDirection =
  | 'BULLISH'
  | 'BEARISH'
  | 'NEUTRAL';

export interface StrategyRuleResult {
  id: string;
  label: string;
  direction: RuleDirection;
  score: number;
  reason: string;
}

export interface StrategySignalResult {
  signal: TradingSignal;
  confidence: number;
  bullishScore: number;
  bearishScore: number;
  evaluatedAt: Date;
  candleCloseTime: Date;
  rules: StrategyRuleResult[];
  reasons: string[];
}

export interface StrategyContext {
  snapshot: IndicatorSnapshot;
}