export interface TechnicalStrategyConfig {
  smaFastPeriod: number;
  smaSlowPeriod: number;
  emaFastPeriod: number;
  emaSlowPeriod: number;
  rsiPeriod: number;
  atrPeriod: number;
  longThreshold: number;
  shortThreshold: number;
}

export const DEFAULT_TECHNICAL_STRATEGY_CONFIG:
  TechnicalStrategyConfig = {
    smaFastPeriod: 20,
    smaSlowPeriod: 50,
    emaFastPeriod: 9,
    emaSlowPeriod: 21,
    rsiPeriod: 14,
    atrPeriod: 14,
    longThreshold: 60,
    shortThreshold: 60,
  };