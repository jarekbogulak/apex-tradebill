import { formatDecimalString } from '../serialize.js';

describe('formatDecimalString', () => {
  test.each([
    [0, 4, '0'],
    [0.02, 4, '0.02'],
    [0.05, 4, '0.05'],
    [0.5, 4, '0.5'],
    [0.125, 4, '0.125'],
    [0.1234, 4, '0.1234'],
    [0.12345, 4, '0.1235'],
    [2, 4, '2'],
    [2.5, 2, '2.5'],
    [1.2, 2, '1.2'],
    [1.234, 2, '1.23'],
    [0.0005, 4, '0.0005'],
  ])('formats %f with %d fraction digits', (value, digits, expected) => {
    expect(formatDecimalString(value, digits)).toBe(expected);
  });
});
