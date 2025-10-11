import type { UserSettings } from '../../domain/user-settings/user-settings.entity.js';

export const formatDecimalString = (value: number, fractionDigits: number): string => {
  return value
    .toFixed(fractionDigits)
    .replace(/(\.\d*?)(0+)$/, (_, decimals: string, zeroes: string) =>
      decimals.slice(0, decimals.length - zeroes.length),
    )
    .replace(/\.$/, '');
};

export const serializeSettings = (settings: UserSettings) => {
  return {
    riskPercent: formatDecimalString(settings.riskPercent, 4),
    atrMultiplier: formatDecimalString(settings.atrMultiplier, 2),
    dataFreshnessThresholdMs: settings.dataFreshnessThresholdMs,
    defaultSymbol: settings.defaultSymbol,
    defaultTimeframe: settings.defaultTimeframe,
    rememberedMultiplierOptions: settings.rememberedMultiplierOptions.map((value) =>
      formatDecimalString(value, 2),
    ),
  };
};
