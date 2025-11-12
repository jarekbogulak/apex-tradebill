import type { UserSettings } from '../../../../domain/user-settings/user-settings.entity.js';

export const formatDecimalString = (value: number, fractionDigits: number): string => {
  const fixed = value.toFixed(fractionDigits);

  if (!fixed.includes('.')) {
    return fixed;
  }

  return fixed
    .replace(/(\.\d*?[1-9])0+$/, '$1')
    .replace(/\.0+$/, '')
    .replace(/\.$/, '');
};

export const serializeSettings = (settings: UserSettings) => {
  return {
    riskPercent: formatDecimalString(settings.riskPercent, 4),
    atrMultiplier: formatDecimalString(settings.atrMultiplier, 2),
    dataFreshnessThresholdMs: settings.dataFreshnessThresholdMs,
    defaultSymbol: settings.defaultSymbol,
    defaultTimeframe: settings.defaultTimeframe,
    rememberedMultiplierOptions: settings.rememberedMultiplierOptions.map((value: number) =>
      formatDecimalString(value, 2),
    ),
  };
};
