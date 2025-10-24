import { contrastRatio, formatCurrency, formatPercent, getContrastTokens } from '../formatting.ts';

describe('Formatting utilities', () => {
  test('applies locale-aware currency and percentage formats', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
    expect(formatCurrency('9876.5', { locale: 'en-GB', currency: 'GBP' })).toBe('£9,876.50');
    expect(formatPercent(0.025, { minimumFractionDigits: 1, maximumFractionDigits: 1 })).toBe('2.5%');
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
