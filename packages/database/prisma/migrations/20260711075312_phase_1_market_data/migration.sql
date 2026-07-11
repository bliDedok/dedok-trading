-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CandleTimeframe" AS ENUM ('M15', 'H1', 'H4', 'D1');

-- CreateEnum
CREATE TYPE "MarketDataSource" AS ENUM ('BINANCE');

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "baseAsset" TEXT NOT NULL,
    "quoteAsset" TEXT NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "pricePrecision" INTEGER NOT NULL,
    "quantityPrecision" INTEGER NOT NULL,
    "minQuantity" DECIMAL(30,12),
    "stepSize" DECIMAL(30,12),
    "minNotional" DECIMAL(30,12),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candle" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" "CandleTimeframe" NOT NULL,
    "source" "MarketDataSource" NOT NULL DEFAULT 'BINANCE',
    "openTime" TIMESTAMP(3) NOT NULL,
    "closeTime" TIMESTAMP(3) NOT NULL,
    "open" DECIMAL(30,12) NOT NULL,
    "high" DECIMAL(30,12) NOT NULL,
    "low" DECIMAL(30,12) NOT NULL,
    "close" DECIMAL(30,12) NOT NULL,
    "volume" DECIMAL(38,18) NOT NULL,
    "quoteVolume" DECIMAL(38,18) NOT NULL,
    "tradeCount" INTEGER NOT NULL,
    "takerBuyBaseVolume" DECIMAL(38,18) NOT NULL,
    "takerBuyQuoteVolume" DECIMAL(38,18) NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT true,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Asset_symbol_key" ON "Asset"("symbol");

-- CreateIndex
CREATE INDEX "Asset_status_symbol_idx" ON "Asset"("status", "symbol");

-- CreateIndex
CREATE INDEX "Candle_symbol_timeframe_openTime_idx" ON "Candle"("symbol", "timeframe", "openTime");

-- CreateIndex
CREATE INDEX "Candle_timeframe_closeTime_idx" ON "Candle"("timeframe", "closeTime");

-- CreateIndex
CREATE INDEX "Candle_isClosed_closeTime_idx" ON "Candle"("isClosed", "closeTime");

-- CreateIndex
CREATE UNIQUE INDEX "Candle_assetId_timeframe_openTime_key" ON "Candle"("assetId", "timeframe", "openTime");

-- AddForeignKey
ALTER TABLE "Candle" ADD CONSTRAINT "Candle_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
