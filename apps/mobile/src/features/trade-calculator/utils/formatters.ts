export const DEFAULT_EMPTY_VALUE = '—';

/**
 * Normalizes price-like values for display while preserving non-numeric strings.
 */
export const formatPriceValue = (value: string | number | null | undefined): string => {
  if (value == null || value === '') {
    return DEFAULT_EMPTY_VALUE;
  }

  const numericValue = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(numericValue)) {
    return String(value);
  }

  return numericValue.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};
