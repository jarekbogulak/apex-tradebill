export type ThemeColorScheme = 'light' | 'dark';

export type ThemeColorToken =
  | 'background'
  | 'backgroundMuted'
  | 'surface'
  | 'surfaceAlt'
  | 'surfaceMuted'
  | 'overlay'
  | 'border'
  | 'divider'
  | 'shadow'
  | 'textPrimary'
  | 'textSecondary'
  | 'textMuted'
  | 'textInverted'
  | 'accent'
  | 'accentMuted'
  | 'success'
  | 'successOn'
  | 'successSurface'
  | 'warning'
  | 'warningOn'
  | 'warningSurface'
  | 'error'
  | 'errorOn'
  | 'errorSurface'
  | 'neutral'
  | 'neutralOn'
  | 'neutralSurface'
  | 'chartPositive'
  | 'chartNegative'
  | 'chartNeutral'
  | 'focusRing';

export type ThemeColorTokens = Record<ThemeColorToken, string>;

export type ThemeSpacingToken = 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

export type ThemeSpacingScale = Record<ThemeSpacingToken, number>;

export type ThemeRadiusToken = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'pill';

export type ThemeRadiusScale = Record<ThemeRadiusToken, number>;

export interface ThemeShadowValue {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: {
    width: number;
    height: number;
  };
  elevation: number;
}

export type ThemeShadowToken = 'level0' | 'level1' | 'level2';

export type ThemeShadowScale = Record<ThemeShadowToken, ThemeShadowValue>;

export interface ThemeTypographyScale {
  fontFamilies: {
    sans: string;
    serif: string;
    mono: string;
  };
  fontSizes: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  lineHeights: {
    tight: number;
    snug: number;
    normal: number;
    relaxed: number;
  };
  fontWeights: {
    regular: string;
    medium: string;
    semibold: string;
    bold: string;
  };
}

export interface ThemeShapeTokens {
  radii: ThemeRadiusScale;
  spacing: ThemeSpacingScale;
  shadows: ThemeShadowScale;
}

export interface ThemeTokens {
  scheme: ThemeColorScheme;
  colors: ThemeColorTokens;
  spacing: ThemeSpacingScale;
  radii: ThemeRadiusScale;
  shadows: ThemeShadowScale;
  typography: ThemeTypographyScale;
}

export interface CreateThemeOptions {
  scheme: ThemeColorScheme;
  overrides?: {
    colors?: Partial<ThemeColorTokens>;
    spacing?: Partial<ThemeSpacingScale>;
    radii?: Partial<ThemeRadiusScale>;
    shadows?: Partial<ThemeShadowScale>;
    typography?: Partial<ThemeTypographyScale>;
  };
}
