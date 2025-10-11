import Decimal from 'decimal.js-light';

Decimal.set({
  precision: 24,
  rounding: Decimal.ROUND_HALF_UP,
});

export type DecimalValue = Decimal | number | string;

const DEFAULT_PRICE_TICK = '0.01';
const DEFAULT_QUANTITY_STEP = '0.000001';

const countFractionDigits = (value: string): number => {
  const [, fraction = ''] = value.split('.');
  return fraction.length;
};

const toDecimal = (value: DecimalValue): Decimal => {
  return new Decimal(value);
};

export interface PrecisionRules {
  priceTickSize?: string | null;
  quantityStepSize?: string | null;
  minQuantity?: string | null;
  minNotional?: string | null;
}

export const floorToStepSize = (value: DecimalValue, stepSize?: string | null): string => {
  const normalizedStep = stepSize && stepSize !== '0' ? stepSize : DEFAULT_QUANTITY_STEP;
  const step = toDecimal(normalizedStep);
  if (step.lte(0)) {
    throw new Error('Step size must be positive');
  }

  const ratio = toDecimal(value).div(step);
  const floored = ratio.toDecimalPlaces(0, Decimal.ROUND_FLOOR).mul(step);
  return floored.toFixed(countFractionDigits(normalizedStep));
};

export const roundPriceToTick = (value: DecimalValue, tickSize?: string | null): string => {
  const normalizedTick = tickSize && tickSize !== '0' ? tickSize : DEFAULT_PRICE_TICK;
  const tick = toDecimal(normalizedTick);
  if (tick.lte(0)) {
    throw new Error('Tick size must be positive');
  }

  const digits = countFractionDigits(normalizedTick);
  const rounded = toDecimal(value).div(tick).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).mul(tick);
  return rounded.toFixed(digits);
};

export const roundCurrency = (value: DecimalValue, fractionDigits = 2): string => {
  return toDecimal(value).toFixed(fractionDigits, Decimal.ROUND_HALF_UP);
};

export const formatRiskToReward = (value: DecimalValue, fractionDigits = 2): number => {
  return Number(toDecimal(value).toFixed(fractionDigits, Decimal.ROUND_HALF_UP));
};

export const violatesMinQuantity = (
  quantity: DecimalValue,
  minQuantity?: string | null,
): boolean => {
  if (!minQuantity) {
    return false;
  }

  return toDecimal(quantity).lt(minQuantity);
};

export const violatesMinNotional = (
  positionCost: DecimalValue,
  minNotional?: string | null,
): boolean => {
  if (!minNotional) {
    return false;
  }

  return toDecimal(positionCost).lt(minNotional);
};

export interface TradeAmounts {
  positionSize: DecimalValue;
  positionCost: DecimalValue;
  riskAmount: DecimalValue;
  suggestedStop: DecimalValue;
  riskToReward: DecimalValue;
}

export interface RoundedTradeAmounts {
  positionSize: string;
  positionCost: string;
  riskAmount: string;
  suggestedStop: string;
  riskToReward: number;
}

export const applyTradePrecision = (
  amounts: TradeAmounts,
  precision: PrecisionRules = {},
): RoundedTradeAmounts => {
  const positionSize = floorToStepSize(amounts.positionSize, precision.quantityStepSize);
  const positionCost = roundCurrency(amounts.positionCost);
  const riskAmount = roundCurrency(amounts.riskAmount);
  const suggestedStop = roundPriceToTick(amounts.suggestedStop, precision.priceTickSize);
  const riskToReward = formatRiskToReward(amounts.riskToReward);

  return {
    positionSize,
    positionCost,
    riskAmount,
    suggestedStop,
    riskToReward,
  };
};
