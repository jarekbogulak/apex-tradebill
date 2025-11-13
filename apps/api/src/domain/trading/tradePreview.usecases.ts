import {
  TradeInputSchema,
  TradeOutputSchema,
  TradeWarningCodeSchema,
  type MarketSnapshot,
  type TradeCalculation,
  type TradeInput,
  type TradeOutput,
  type TradeSource,
  type TradeWarningCode,
} from '@apex-tradebill/types';
import {
  applyTradePrecision,
  floorToStepSize,
  violatesMinNotional,
  violatesMinQuantity,
} from '@apex-tradebill/utils';
import Decimal from 'decimal.js-light/decimal.js';
import { calculateAtr } from './atrCalculator.js';
import type { MarketDataPort, MarketMetadataPort } from '../ports/tradebillPorts.js';
import {
  createTradeCalculation,
  type TradeCalculationRepository,
} from '../trade-calculation/trade-calculation.entity.js';

export interface TradePreviewResult {
  output: TradeOutput;
  marketSnapshot: MarketSnapshot;
  warnings: TradeWarningCode[];
}

export interface TradeExecuteResult extends TradePreviewResult {
  calculation: TradeCalculation;
}

interface TradeComputation extends TradePreviewResult {
  input: TradeInput;
  source: TradeSource;
}

export interface PreviewTradeDeps {
  marketData: MarketDataPort;
  metadata: MarketMetadataPort;
}

export interface ExecuteTradeDeps extends PreviewTradeDeps {
  tradeCalculations: TradeCalculationRepository;
}

export type PreviewTradeUseCase = (
  userId: string,
  input: TradeInput,
) => Promise<TradePreviewResult>;
export type ExecuteTradeUseCase = (
  userId: string,
  input: TradeInput,
) => Promise<TradeExecuteResult>;

type DecimalLike = InstanceType<typeof Decimal>;

const dedupeWarnings = (warnings: TradeWarningCode[]): TradeWarningCode[] => {
  return Array.from(new Set(warnings));
};

const toDecimal = (value: string | number) => new Decimal(value);

const formatAtr = (value: number): string => {
  return value.toFixed(8);
};

const isPriceOrderingValid = (
  input: TradeInput,
  entryPrice: DecimalLike,
  stopPrice: DecimalLike,
): boolean => {
  if (input.direction === 'long') {
    return entryPrice.gt(stopPrice);
  }

  return stopPrice.gt(entryPrice);
};

const computeRewardPerUnit = (input: TradeInput, entryPrice: DecimalLike): DecimalLike => {
  const target = toDecimal(input.targetPrice);
  return input.direction === 'long' ? target.minus(entryPrice) : entryPrice.minus(target);
};

const computeSuggestedStop = (
  input: TradeInput,
  lastPrice: DecimalLike,
  atrValue: DecimalLike,
): DecimalLike => {
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
  suggestedStop: DecimalLike;
  manualStop: DecimalLike | null;
  riskPerUnit: DecimalLike;
  rewardPerUnit: DecimalLike;
  positionSize: DecimalLike;
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

  if (input.useVolatilityStop && manualStop) {
    const manualStopComparison =
      input.direction === 'long' ? manualStop.gt(suggestedStop) : manualStop.lt(suggestedStop);

    if (manualStopComparison) {
      warnings.push('VOLATILITY_STOP_GREATER');
    }
  }

  if (!input.useVolatilityStop && manualStop == null) {
    warnings.push('STOP_OUTSIDE_RANGE');
  }

  if (violatesMinQuantity(rounded.positionSize, metadata.minQuantity ?? null)) {
    warnings.push('MIN_LOT_SIZE');
  }

  if (violatesMinNotional(rounded.positionCost, metadata.minNotional ?? null)) {
    warnings.push('MIN_NOTIONAL');
  }

  return dedupeWarnings(warnings).filter(
    (warning) => TradeWarningCodeSchema.safeParse(warning).success,
  );
};

const makeTradeComputation = ({ marketData, metadata }: PreviewTradeDeps) => {
  return async (rawInput: TradeInput): Promise<TradeComputation> => {
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

    const entryPrice = input.entryPrice
      ? toDecimal(input.entryPrice)
      : toDecimal(snapshot.lastPrice);
    const suggestedStop = computeSuggestedStop(input, entryPrice, atrValue);
    const manualStop = input.stopPrice ? toDecimal(input.stopPrice) : null;

    if (!input.useVolatilityStop && manualStop == null) {
      throw new Error('Stop price is required when volatility stop is disabled');
    }

    const effectiveStop =
      input.useVolatilityStop || manualStop == null ? suggestedStop : manualStop;

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

    const rawPositionSize = riskPerUnit.gt(0) ? riskBudget.div(riskPerUnit) : new Decimal(0);

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

    const atrValueString = formatAtr(atrResult.value);

    const parsedOutput = TradeOutputSchema.parse({
      ...rounded,
      atr13: atrValueString,
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
      atr13: atrValueString,
      atrMultiplier: input.atrMultiplier,
    };
    const source: TradeSource = input.accountEquitySource === 'manual' ? 'manual' : 'live';

    return {
      input,
      output,
      marketSnapshot,
      warnings,
      source,
    };
  };
};

export const makePreviewTrade = (deps: PreviewTradeDeps): PreviewTradeUseCase => {
  const computeTrade = makeTradeComputation(deps);
  return async (_userId, rawInput) => {
    const result = await computeTrade(rawInput);
    return {
      output: result.output,
      marketSnapshot: result.marketSnapshot,
      warnings: result.warnings,
    };
  };
};

export const makeExecuteTrade = (deps: ExecuteTradeDeps): ExecuteTradeUseCase => {
  const computeTrade = makeTradeComputation(deps);
  const { tradeCalculations } = deps;

  return async (userId, rawInput) => {
    const result = await computeTrade(rawInput);
    const calculation = createTradeCalculation({
      userId,
      executionMethod: 'execute-button',
      input: result.input,
      output: result.output,
      marketSnapshot: result.marketSnapshot,
      source: result.source,
    });

    const saved = await tradeCalculations.save(calculation);

    return {
      calculation: saved,
      output: result.output,
      marketSnapshot: result.marketSnapshot,
      warnings: result.warnings,
    };
  };
};
