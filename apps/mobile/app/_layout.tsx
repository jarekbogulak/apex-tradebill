import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef } from 'react';
import 'react-native-reanimated';

import { ThemeProvider as ApexThemeProvider } from '@apex-tradebill/ui';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { createQueryClient } from '@/src/services/apiClient';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const queryClientRef = useRef(createQueryClient());
  const resolvedScheme = colorScheme ?? 'light';

  return (
    <QueryClientProvider client={queryClientRef.current}>
      <ApexThemeProvider scheme={resolvedScheme}>
        <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style="auto" />
        </NavigationThemeProvider>
      </ApexThemeProvider>
    </QueryClientProvider>
  );
}
