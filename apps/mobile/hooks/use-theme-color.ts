import { useTheme, type ThemeColorToken } from '@apex-tradebill/ui';

const COLOR_TOKEN_MAP: Record<string, ThemeColorToken> = {
  background: 'background',
  text: 'textPrimary',
  tint: 'accent',
  icon: 'neutral',
  tabIconDefault: 'neutral',
  tabIconSelected: 'accent',
};

type ThemeTokenName = ThemeColorToken | keyof typeof COLOR_TOKEN_MAP;

export function useThemeColor(
  props: Partial<Record<'light' | 'dark', string>>,
  colorName: ThemeTokenName,
) {
  const theme = useTheme();
  const override = props[theme.scheme];
  const resolvedToken = COLOR_TOKEN_MAP[String(colorName)] ?? (colorName as ThemeColorToken);

  if (override) {
    return override;
  }

  return theme.colors[resolvedToken];
}
