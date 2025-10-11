import {
  TradeInputSchema,
  TradeOutputSchema,
  TradeWarningCodeSchema,
  type MarketSnapshot,
  type TradeInput,
  type TradeOutput,
  type TradeWarningCode,
} from '@apex-tradebill/types';
import {
  applyTradePrecision,
  floorToStepSize,
  violatesMinNotional,
  violatesMinQuantity,
} from '@apex-tradebill/utils';
import Decimal from 'decimal.js-light';
import { calculateAtr } from '../calculations/atrCalculator.js';
import type {
  MarketDataPort,
  MarketMetadataPort,
} from '../../domain/ports/tradebillPorts.js';
import { createTradeCalculation } from '../../domain/trade-calculation/trade-calculation.entity.js';
import type { TradeCalculationRepository } from '../../domain/trade-calculation/trade-calculation.entity.js';

export interface TradePreviewServiceDeps {
  marketData: MarketDataPort;
  metadata: MarketMetadataPort;
  tradeCalculations: TradeCalculationRepository;
}

export interface TradePreviewResult {
  output: TradeOutput;
  marketSnapshot: MarketSnapshot;
  warnings: TradeWarningCode[];
}

const dedupeWarnings = (warnings: TradeWarningCode[]): TradeWarningCode[] => {
  return Array.from(new Set(warnings));
};

const toDecimal = (value: string | number): Decimal => new Decimal(value);

const formatAtr = (value: number): string => {
  return value.toFixed(8);
};

const isPriceOrderingValid = (input: TradeInput, entryPrice: Decimal, stopPrice: Decimal): boolean => {
  if (input.direction === 'long') {
    return entryPrice.gt(stopPrice);
  }

  return stopPrice.gt(entryPrice);
};

const computeRewardPerUnit = (input: TradeInput, entryPrice: Decimal): Decimal => {
  const target = toDecimal(input.targetPrice);
  return input.direction === 'long' ? target.minus(entryPrice) : entryPrice.minus(target);
};

const computeSuggestedStop = (
  input: TradeInput,
  lastPrice: Decimal,
  atrValue: Decimal,
): Decimal => {
  const multiplier = toDecimal(input.atrMultiplier);
  const displacement = atrValue.times(multiplier);

  if (input.direction === 'long') {
    return lastPrice.minus(displacement);
  }

  return lastPrice.plus(displacement);
};

const collectWarnings = ({
  input,
  snapshot,
  suggestedStop,
  manualStop,
  riskPerUnit,
  rewardPerUnit,
  positionSize,
  metadata,
  rounded,
}: {
  input: TradeInput;
  snapshot: MarketSnapshot;
  suggestedStop: Decimal;
  manualStop: Decimal;
  riskPerUnit: Decimal;
  rewardPerUnit: Decimal;
  positionSize: Decimal;
  metadata: { minNotional?: string | null; minQuantity?: string | null };
  rounded: TradeOutput;
}): TradeWarningCode[] => {
  const warnings: TradeWarningCode[] = [];

  if (snapshot.stale) {
    warnings.push('ATR_STALE');
  }

  if (riskPerUnit.lte(0)) {
    warnings.push('STOP_OUTSIDE_RANGE');
  }

  if (rewardPerUnit.lte(0)) {
    warnings.push('TARGET_OUTSIDE_RANGE');
  }

  if (positionSize.lte(0)) {
    warnings.push('INSUFFICIENT_EQUITY');
  }

  const manualStopComparison =
    input.direction === 'long'
      ? manualStop.gt(suggestedStop)
      : manualStop.lt(suggestedStop);

  if (input.useVolatilityStop && manualStopComparison) {
    warnings.push('VOLATILITY_STOP_GREATER');
  }

  if (violatesMinQuantity(rounded.positionSize, metadata.minQuantity ?? null)) {
    warnings.push('MIN_LOT_SIZE');
  }

  if (violatesMinNotional(rounded.positionCost, metadata.minNotional ?? null)) {
    warnings.push('MIN_NOTIONAL');
  }

  return dedupeWarnings(warnings).filter((warning) =>
    TradeWarningCodeSchema.safeParse(warning).success,
  );
};

export const createTradePreviewService = ({
  marketData,
  metadata,
  tradeCalculations,
}: TradePreviewServiceDeps) => {
  const preview = async (userId: string, rawInput: TradeInput): Promise<TradePreviewResult> => {
    const input = TradeInputSchema.parse(rawInput);

    const symbolMetadata = await metadata.getMetadata(input.symbol);
    if (!symbolMetadata) {
      throw new Error(`Symbol ${input.symbol} is not available`);
    }

    if (symbolMetadata.status !== 'tradable') {
      throw new Error(`Symbol ${input.symbol} is currently suspended`);
    }

    const snapshot = await marketData.getLatestSnapshot(input.symbol);
    if (!snapshot) {
      throw new Error(`No market snapshot available for ${input.symbol}`);
    }

    const candles = await marketData.getRecentCandles(input.symbol, input.timeframe, 13);
    if (candles.length < 13) {
      throw new Error('Insufficient market data to calculate ATR');
    }

    const atrResult = calculateAtr(candles, 13);
    const atrValue = new Decimal(atrResult.value);

    const entryPrice = input.entryPrice ? toDecimal(input.entryPrice) : toDecimal(snapshot.lastPrice);
    const suggestedStop = computeSuggestedStop(input, entryPrice, atrValue);
    const manualStop = toDecimal(input.stopPrice);
    const effectiveStop = input.useVolatilityStop ? suggestedStop : manualStop;

    if (!isPriceOrderingValid(input, entryPrice, effectiveStop)) {
      throw new Error('Stop price is inconsistent with trade direction');
    }

    const riskPercent = toDecimal(input.riskPercent);
    const accountSize = toDecimal(input.accountSize);
    const riskBudget = accountSize.times(riskPercent);

    const riskPerUnit =
      input.direction === 'long'
        ? entryPrice.minus(effectiveStop)
        : effectiveStop.minus(entryPrice);

    const rewardPerUnit = computeRewardPerUnit(input, entryPrice);

    const rawPositionSize = riskPerUnit.gt(0)
      ? riskBudget.div(riskPerUnit)
      : new Decimal(0);

    const flooredPositionSize = new Decimal(
      floorToStepSize(rawPositionSize.toString(), symbolMetadata.stepSize),
    );

    const positionCost = flooredPositionSize.times(entryPrice);
    const riskAmount = flooredPositionSize.times(riskPerUnit);

    const rounded = applyTradePrecision(
      {
        positionSize: flooredPositionSize.toString(),
        positionCost,
        riskAmount,
        suggestedStop: effectiveStop,
        riskToReward:
          riskPerUnit.gt(0) && rewardPerUnit.gt(0)
            ? rewardPerUnit.div(riskPerUnit)
            : new Decimal(0),
      },
      {
        priceTickSize: symbolMetadata.tickSize,
        quantityStepSize: symbolMetadata.stepSize,
        minNotional: symbolMetadata.minNotional,
        minQuantity: symbolMetadata.minQuantity,
      },
    );

    const parsedOutput = TradeOutputSchema.parse({
      ...rounded,
      warnings: [],
    });

    const warnings = collectWarnings({
      input,
      snapshot,
      suggestedStop,
      manualStop,
      riskPerUnit,
      rewardPerUnit,
      positionSize: flooredPositionSize,
      metadata: {
        minNotional: symbolMetadata.minNotional,
        minQuantity: symbolMetadata.minQuantity,
      },
      rounded: parsedOutput,
    });

    const output: TradeOutput = TradeOutputSchema.parse({
      ...parsedOutput,
      warnings,
    });

    const marketSnapshot: MarketSnapshot = {
      ...snapshot,
      atr13: formatAtr(atrResult.value),
      atrMultiplier: input.atrMultiplier,
    };

    const calculation = createTradeCalculation({
      userId,
      input,
      output,
      marketSnapshot,
      source: input.accountEquitySource === 'manual' ? 'manual' : 'live',
    });

    await tradeCalculations.save(calculation);

    return {
      output,
      marketSnapshot,
      warnings,
    };
  };

  return {
    preview,
  };
};
