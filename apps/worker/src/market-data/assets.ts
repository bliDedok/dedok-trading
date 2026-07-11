import type { SupportedSymbol } from '@dedok/shared';

export interface AssetDefinition {
  symbol: SupportedSymbol;
  baseAsset: string;
  quoteAsset: string;
  pricePrecision: number;
  quantityPrecision: number;
  minQuantity: string | null;
  stepSize: string | null;
  minNotional: string | null;
}

export const mvpAssets = [
  {
    symbol: 'BTCUSDT',
    baseAsset: 'BTC',
    quoteAsset: 'USDT',
    pricePrecision: 8,
    quantityPrecision: 8,
    minQuantity: null,
    stepSize: null,
    minNotional: null,
  },
  {
    symbol: 'ETHUSDT',
    baseAsset: 'ETH',
    quoteAsset: 'USDT',
    pricePrecision: 8,
    quantityPrecision: 8,
    minQuantity: null,
    stepSize: null,
    minNotional: null,
  },
  {
    symbol: 'SOLUSDT',
    baseAsset: 'SOL',
    quoteAsset: 'USDT',
    pricePrecision: 8,
    quantityPrecision: 8,
    minQuantity: null,
    stepSize: null,
    minNotional: null,
  },
] as const satisfies readonly AssetDefinition[];