import {
  applyTradePrecision,
  floorToStepSize,
  formatRiskToReward,
  roundCurrency,
  roundPriceToTick,
  violatesMinNotional,
  violatesMinQuantity,
} from '../rounding.ts';

describe('Rounding rules utilities', () => {
  test('enforces tick size floors for market quantities', () => {
    const stepResult = floorToStepSize('1.234987', '0.001');
    expect(stepResult).toBe('1.234');

    const priceResult = roundPriceToTick('48250.004', '0.01');
    expect(priceResult).toBe('48250.00');

    const precisionResult = applyTradePrecision(
      {
        positionSize: '1.234987',
        positionCost: '48250.004',
        riskAmount: '965.4321',
        suggestedStop: '48100.004',
        riskToReward: '2.4567',
      },
      {
        priceTickSize: '0.01',
        quantityStepSize: '0.001',
      },
    );

    expect(precisionResult).toEqual({
      positionSize: '1.234',
      positionCost: '48250.00',
      riskAmount: '965.43',
      suggestedStop: '48100.00',
      riskToReward: 2.46,
    });
  });

  test('keeps risk-to-reward ratios within precision tolerances', () => {
    expect(formatRiskToReward('2.555')).toBe(2.56);
    expect(formatRiskToReward('1.994')).toBe(1.99);
    expect(roundCurrency('123.456')).toBe('123.46');

    expect(violatesMinQuantity('0.09', '0.1')).toBe(true);
    expect(violatesMinQuantity('0.5', '0.1')).toBe(false);

    expect(violatesMinNotional('9.99', '10')).toBe(true);
    expect(violatesMinNotional('10.00', '10')).toBe(false);
  });
});
