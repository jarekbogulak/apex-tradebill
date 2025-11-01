import type {
  ThemeRadiusScale,
  ThemeShadowScale,
  ThemeSpacingScale,
  ThemeTypographyScale,
} from './types.ts';

export const spacing: ThemeSpacingScale = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radii: ThemeRadiusScale = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
};

export const shadows: ThemeShadowScale = {
  level0: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    elevation: 0,
  },
  level1: {
    shadowColor: '#0F172A12',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 4,
  },
  level2: {
    shadowColor: '#0F172A1F',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    elevation: 8,
  },
};

export const typography: ThemeTypographyScale = {
  fontFamilies: {
    sans: 'System',
    serif: 'Georgia',
    mono: 'Menlo',
  },
  fontSizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  lineHeights: {
    tight: 16,
    snug: 18,
    normal: 22,
    relaxed: 28,
  },
  fontWeights: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
};
