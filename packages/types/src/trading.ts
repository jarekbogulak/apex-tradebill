import { z } from 'zod';

const decimalPattern = /^-?\d+(?:\.\d+)?$/;

const createDecimalStringSchema = ({
  allowNegative = false,
  maxFractionDigits,
}: {
  allowNegative?: boolean;
  maxFractionDigits?: number;
} = {}) => {
  return z
    .string()
    .trim()
    .refine((value) => decimalPattern.test(value), 'Invalid decimal string')
    .refine((value) => {
      if (!allowNegative && value.startsWith('-')) {
        return false;
      }
      if (maxFractionDigits == null) {
        return true;
      }

      const [, fraction = ''] = value.split('.');
      return fraction.length <= maxFractionDigits;
    }, `Fractional precision must be <= ${maxFractionDigits ?? 0} digits`);
};

export const SymbolSchema = z
  .string()
  .trim()
  .regex(/^[A-Z]{3,5}-USDT$/, 'Unsupported trading symbol');
export type Symbol = z.infer<typeof SymbolSchema>;

export const DirectionSchema = z.enum(['long', 'short']);
export type Direction = z.infer<typeof DirectionSchema>;

export const TimeframeSchema = z.enum(['1m', '5m', '15m', '30m', '1h', '4h']);
export type Timeframe = z.infer<typeof TimeframeSchema>;

export const AccountEquitySourceSchema = z.enum(['connected', 'manual']);
export type AccountEquitySource = z.infer<typeof AccountEquitySourceSchema>;

export const MarketDataSourceSchema = z.enum(['stream', 'manual']);
export type MarketDataSource = z.infer<typeof MarketDataSourceSchema>;

export const TradeSourceSchema = z.enum(['live', 'manual']);
export type TradeSource = z.infer<typeof TradeSourceSchema>;

export const TradeWarningCodeSchema = z.enum([
  'ATR_STALE',
  'INSUFFICIENT_EQUITY',
  'MIN_LOT_SIZE',
  'MIN_NOTIONAL',
  'STOP_OUTSIDE_RANGE',
  'TARGET_OUTSIDE_RANGE',
  'VOLATILITY_STOP_GREATER',
]);
export type TradeWarningCode = z.infer<typeof TradeWarningCodeSchema>;

const currencyStringSchema = createDecimalStringSchema({ maxFractionDigits: 2 });
const priceStringSchema = createDecimalStringSchema({ maxFractionDigits: 8 });
const quantityStringSchema = createDecimalStringSchema({ maxFractionDigits: 8 });

export const TradeInputSchema = z
  .object({
    symbol: SymbolSchema,
    direction: DirectionSchema,
    accountSize: currencyStringSchema.refine(
      (value) => Number(value) > 0,
      'Account size must be greater than zero',
    ),
    entryPrice: priceStringSchema.nullable().optional(),
    stopPrice: priceStringSchema.refine((value) => Number(value) > 0, 'Stop price must be positive'),
    targetPrice: priceStringSchema.refine(
      (value) => Number(value) > 0,
      'Target price must be positive',
    ),
    riskPercent: createDecimalStringSchema({ maxFractionDigits: 4 }).refine((value) => {
      const numeric = Number(value);
      return numeric > 0 && numeric <= 1;
    }, 'Risk percent must be between 0 and 1'),
    atrMultiplier: createDecimalStringSchema({ maxFractionDigits: 2 }).refine((value) => {
      const numeric = Number(value);
      return numeric >= 0.5 && numeric <= 3.0;
    }, 'ATR multiplier must be between 0.5 and 3'),
    useVolatilityStop: z.boolean(),
    timeframe: TimeframeSchema,
    accountEquitySource: AccountEquitySourceSchema.default('connected'),
    createdAt: z.string().datetime().optional(),
  })
  .refine(
    (value) => {
      if (value.entryPrice == null) {
        return true;
      }

      const entry = Number(value.entryPrice);
      const stop = Number(value.stopPrice);
      const target = Number(value.targetPrice);

      if (value.direction === 'long') {
        return target > entry && entry > stop;
      }

      return target < entry && entry < stop;
    },
    {
      message: 'Price ordering is inconsistent with trade direction',
      path: ['direction'],
    },
  );
export type TradeInput = z.infer<typeof TradeInputSchema>;

export const TradeOutputSchema = z.object({
  positionSize: quantityStringSchema.refine(
    (value) => Number(value) >= 0,
    'Position size must be non-negative',
  ),
  positionCost: currencyStringSchema.refine(
    (value) => Number(value) >= 0,
    'Position cost must be non-negative',
  ),
  riskAmount: currencyStringSchema.refine(
    (value) => Number(value) >= 0,
    'Risk amount must be non-negative',
  ),
  riskToReward: z.number().finite(),
  suggestedStop: priceStringSchema.refine(
    (value) => Number(value) > 0,
    'Suggested stop must be positive',
  ),
  warnings: z.array(TradeWarningCodeSchema).default([]),
});
export type TradeOutput = z.infer<typeof TradeOutputSchema>;

export const MarketSnapshotSchema = z.object({
  symbol: SymbolSchema,
  lastPrice: priceStringSchema,
  bid: priceStringSchema.nullable().optional(),
  ask: priceStringSchema.nullable().optional(),
  atr13: priceStringSchema,
  atrMultiplier: createDecimalStringSchema({ maxFractionDigits: 2 }),
  stale: z.boolean(),
  source: MarketDataSourceSchema,
  serverTimestamp: z.string().datetime(),
});
export type MarketSnapshot = z.infer<typeof MarketSnapshotSchema>;

export const TradeCalculationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  input: TradeInputSchema,
  output: TradeOutputSchema,
  marketSnapshot: MarketSnapshotSchema,
  source: TradeSourceSchema,
  createdAt: z.string().datetime(),
});
export type TradeCalculation = z.infer<typeof TradeCalculationSchema>;

export const parseTradeInput = (value: unknown): TradeInput => {
  return TradeInputSchema.parse(value);
};

export const parseTradeOutput = (value: unknown): TradeOutput => {
  return TradeOutputSchema.parse(value);
};

export const parseMarketSnapshot = (value: unknown): MarketSnapshot => {
  return MarketSnapshotSchema.parse(value);
};

export const parseTradeCalculation = (value: unknown): TradeCalculation => {
  return TradeCalculationSchema.parse(value);
};
