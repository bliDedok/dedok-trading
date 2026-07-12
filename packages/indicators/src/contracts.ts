export interface IndicatorCandle {
  openTime: Date;
  closeTime: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type IndicatorValue =
  | number
  | null;

export interface IndicatorSeries {
  values: IndicatorValue[];
  warmupPeriod: number;
}

export interface NamedIndicatorSeries
  extends IndicatorSeries {
  name: string;
}

export interface MacdValue {
  macd: number | null;
  signal: number | null;
  histogram: number | null;
}

export interface BollingerBandValue {
  middle: number | null;
  upper: number | null;
  lower: number | null;
}

export interface IndicatorSnapshot {
  calculatedAt: Date;
  candleOpenTime: Date;
  candleCloseTime: Date;
  close: number;
  sma: Record<string, number | null>;
  ema: Record<string, number | null>;
  rsi: Record<string, number | null>;
  atr: Record<string, number | null>;
  macd: MacdValue;
  bollingerBands: BollingerBandValue;
}