import {
  contrastRatio,
  formatCurrency,
  formatCurrencyCompact,
  formatPercent,
  getContrastTokens,
} from '../formatting.js';

describe('Formatting utilities', () => {
  test('applies locale-aware currency and percentage formats', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
    expect(formatCurrency('9876.5', { locale: 'en-GB', currency: 'GBP' })).toBe('£9,876.50');
    expect(formatPercent(0.025, { minimumFractionDigits: 1, maximumFractionDigits: 1 })).toBe(
      '2.5%',
    );
  });

  test('compacts large currency values while preserving smaller ones', () => {
    expect(formatCurrencyCompact(68272)).toBe('$68K');
    expect(formatCurrencyCompact('12500.50', { compactMaximumFractionDigits: 2 })).toBe('$12.5K');
    expect(formatCurrencyCompact(950)).toBe('$950.00');
  });

  test('falls back to suffix-based compaction when Intl notation is unavailable', () => {
    const originalNumberFormat = Intl.NumberFormat;
    const numberFormatSpy = jest
      .spyOn(Intl, 'NumberFormat')
      .mockImplementation((locale: string | string[], options?: Intl.NumberFormatOptions) => {
        if (options?.notation === 'compact') {
          throw new Error('Unsupported');
        }
        return new originalNumberFormat(locale as string, options);
      });

    jest.isolateModules(() => {
      const { formatCurrencyCompact: fallbackCompact } = require('../formatting.js');
      expect(fallbackCompact(72_025_000)).toBe('$72M');
      expect(fallbackCompact(12_500, { compactMaximumFractionDigits: 1 })).toBe('$12.5K');
    });

    numberFormatSpy.mockRestore();
  });

  test('produces accessible contrast tokens for UI themes', () => {
    (['light', 'dark'] as const).forEach((theme) => {
      const tokens = getContrastTokens(theme);
      const ratioPrimary = contrastRatio(tokens.textPrimary, tokens.background);
      const ratioSecondary = contrastRatio(tokens.textSecondary, tokens.surface);

      expect(ratioPrimary).toBeGreaterThanOrEqual(4.5);
      expect(ratioSecondary).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens.accent, tokens.background)).toBeGreaterThanOrEqual(3);
    });
  });
});
