import { createContext, type ReactNode, useContext, useMemo } from 'react';

import { createTheme, darkTheme, lightTheme } from './theme.js';
import type { CreateThemeOptions, ThemeColorToken, ThemeTokens } from './types.js';

type ThemeContextValue = ThemeTokens;

const ThemeContext = createContext<ThemeContextValue>(lightTheme);

export interface ThemeProviderProps {
  scheme?: ThemeTokens['scheme'];
  overrides?: CreateThemeOptions['overrides'];
  value?: ThemeTokens;
  children?: ReactNode;
}

export const ThemeProvider = ({
  scheme = 'light',
  overrides,
  value,
  children,
}: ThemeProviderProps) => {
  const resolvedTheme = useMemo(() => {
    if (value) {
      return value;
    }

    if (!overrides) {
      return scheme === 'dark' ? darkTheme : lightTheme;
    }

    return createTheme({
      scheme,
      overrides,
    });
  }, [scheme, overrides, value]);

  return <ThemeContext.Provider value={resolvedTheme}>{children}</ThemeContext.Provider>;
};

ThemeProvider.displayName = 'ThemeProvider';

export const useTheme = (): ThemeTokens => {
  return useContext(ThemeContext);
};

export const useThemeColor = (token: ThemeColorToken): string => {
  const theme = useTheme();
  return theme.colors[token];
};

export const ThemeContextInstance = ThemeContext;
