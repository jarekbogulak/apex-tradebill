export interface CurrencyFormatOptions {
  locale?: string;
  currency?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export const formatCurrency = (
  value: number | string,
  {
    locale = 'en-US',
    currency = 'USD',
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  }: CurrencyFormatOptions = {},
): string => {
  const numericValue = typeof value === 'string' ? Number.parseFloat(value) : value;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(numericValue);
};

export interface PercentFormatOptions {
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export const formatPercent = (
  value: number,
  {
    locale = 'en-US',
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  }: PercentFormatOptions = {},
): string => {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);
};

export interface CompactCurrencyFormatOptions extends CurrencyFormatOptions {
  threshold?: number;
  compactMinimumFractionDigits?: number;
  compactMaximumFractionDigits?: number;
}

const compactSuffixTiers = [
  { value: 1_000_000_000_000, suffix: 'T' },
  { value: 1_000_000_000, suffix: 'B' },
  { value: 1_000_000, suffix: 'M' },
  { value: 1_000, suffix: 'K' },
] as const;

const compactSupportCache = new Map<string, boolean>();

const hasNativeCompactSupport = (locale: string, currency: string): boolean => {
  const cacheKey = `${locale}-${currency}`;
  if (compactSupportCache.has(cacheKey)) {
    return compactSupportCache.get(cacheKey) ?? false;
  }

  try {
    const baselineFormatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    const compactFormatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      notation: 'compact',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

    const baseline = baselineFormatter.format(1_000);
    const compact = compactFormatter.format(1_000);
    const supported = baseline !== compact;
    compactSupportCache.set(cacheKey, supported);
    return supported;
  } catch {
    compactSupportCache.set(cacheKey, false);
    return false;
  }
};

export const formatCurrencyCompact = (
  value: number | string,
  {
    threshold = 1000,
    locale = 'en-US',
    currency = 'USD',
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    compactMinimumFractionDigits = 0,
    compactMaximumFractionDigits = 0,
  }: CompactCurrencyFormatOptions = {},
): string => {
  const numericValue = typeof value === 'string' ? Number.parseFloat(value) : value;
  const resolvedValue = Number.isFinite(numericValue) ? numericValue : 0;

  const standardFormatted = formatCurrency(resolvedValue, {
    locale,
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  });

  if (Math.abs(resolvedValue) < threshold) {
    return standardFormatted;
  }

  const compactMin = Math.max(0, compactMinimumFractionDigits ?? 0);
  const compactMax = Math.max(compactMin, compactMaximumFractionDigits ?? compactMin);

  if (hasNativeCompactSupport(locale, currency)) {
    try {
      const compactFormatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        notation: 'compact',
        minimumFractionDigits: compactMin,
        maximumFractionDigits: compactMax,
      });
      const formatted = compactFormatter.format(resolvedValue);

      if (formatted !== standardFormatted) {
        return formatted;
      }
    } catch {
      // fall through to manual fallback
    }
  }

  const absolute = Math.abs(resolvedValue);
  const tier =
    compactSuffixTiers.find(({ value: tierValue }) => absolute >= tierValue) ?? {
      value: threshold,
      suffix: '',
    };

  const scaled = resolvedValue / tier.value;
  const scaledFormatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: compactMin,
    maximumFractionDigits: compactMax,
  });
  return `${scaledFormatter.format(scaled)}${tier.suffix}`;
};

const hexChannelToLinear = (channel: number): number => {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
};

const hexToRgb = (hex: string): [number, number, number] => {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) {
    throw new Error(`Unsupported hex color: ${hex}`);
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return [r, g, b];
};

export const relativeLuminance = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex);
  const rLin = hexChannelToLinear(r);
  const gLin = hexChannelToLinear(g);
  const bLin = hexChannelToLinear(b);
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
};

export const contrastRatio = (foreground: string, background: string): number => {
  const L1 = relativeLuminance(foreground);
  const L2 = relativeLuminance(background);
  const brighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (brighter + 0.05) / (darker + 0.05);
};

export interface ContrastTokens {
  background: string;
  surface: string;
  accent: string;
  warning: string;
  success: string;
  textPrimary: string;
  textSecondary: string;
}

const contrastPalettes: Record<'light' | 'dark', ContrastTokens> = {
  light: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    accent: '#2563EB',
    warning: '#DC2626',
    success: '#16A34A',
    textPrimary: '#0F172A',
    textSecondary: '#334155',
  },
  dark: {
    background: '#0F172A',
    surface: '#1E293B',
    accent: '#38BDF8',
    warning: '#F87171',
    success: '#22C55E',
    textPrimary: '#F8FAFC',
    textSecondary: '#E2E8F0',
  },
};

export const getContrastTokens = (theme: 'light' | 'dark' = 'light'): ContrastTokens => {
  return contrastPalettes[theme];
};
