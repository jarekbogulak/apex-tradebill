import { getColorsForScheme } from './colors.ts';
import { radii, shadows, spacing, typography } from './tokens.ts';
import type { CreateThemeOptions, ThemeTokens, ThemeTypographyScale } from './types.ts';

const mergeTypography = (
  base: ThemeTypographyScale,
  override?: Partial<ThemeTypographyScale>,
): ThemeTypographyScale => {
  if (!override) {
    return base;
  }

  return {
    fontFamilies: {
      ...base.fontFamilies,
      ...override.fontFamilies,
    },
    fontSizes: {
      ...base.fontSizes,
      ...override.fontSizes,
    },
    lineHeights: {
      ...base.lineHeights,
      ...override.lineHeights,
    },
    fontWeights: {
      ...base.fontWeights,
      ...override.fontWeights,
    },
  };
};

export const createTheme = ({ scheme, overrides }: CreateThemeOptions): ThemeTokens => {
  const colorTokens = {
    ...getColorsForScheme(scheme),
    ...(overrides?.colors ?? {}),
  };

  return {
    scheme,
    colors: colorTokens,
    spacing: {
      ...spacing,
      ...(overrides?.spacing ?? {}),
    },
    radii: {
      ...radii,
      ...(overrides?.radii ?? {}),
    },
    shadows: {
      ...shadows,
      ...(overrides?.shadows ?? {}),
    },
    typography: mergeTypography(typography, overrides?.typography),
  };
};

export const lightTheme = createTheme({ scheme: 'light' });
export const darkTheme = createTheme({ scheme: 'dark' });

export const themes = {
  light: lightTheme,
  dark: darkTheme,
};

export type Theme = ThemeTokens;
export type ThemeScheme = Theme['scheme'];
