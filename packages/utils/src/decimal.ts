import DecimalJsLight from 'decimal.js-light';

export interface DecimalInstance {
  div(value: string | number | DecimalInstance): DecimalInstance;
  mul(value: string | number | DecimalInstance): DecimalInstance;
  toDecimalPlaces(places: number, roundingMode?: number): DecimalInstance;
  toFixed(fractionDigits?: number, roundingMode?: number): string;
  lte(value: string | number | DecimalInstance): boolean;
  lt(value: string | number | DecimalInstance): boolean;
}

export type DecimalValue = string | number | DecimalInstance;

type DecimalConfiguration = {
  precision?: number;
  rounding?: number;
};

export interface DecimalConstructor {
  new (value: DecimalValue): DecimalInstance;
  set(config: DecimalConfiguration): void;
  ROUND_HALF_UP: number;
  ROUND_FLOOR: number;
}

const Decimal = DecimalJsLight as unknown as DecimalConstructor;

// Configure default precision and rounding for all Decimal usage across utils.
Decimal.set({
  precision: 24,
  rounding: Decimal.ROUND_HALF_UP,
});

export { Decimal };

export const toDecimal = (value: DecimalValue): DecimalInstance => {
  return value instanceof Decimal ? value : new Decimal(value);
};

export const isDecimal = (value: unknown): value is DecimalInstance => {
  return value instanceof Decimal;
};
