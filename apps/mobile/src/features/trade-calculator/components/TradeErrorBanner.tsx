import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { useTheme, type Theme } from '@apex-tradebill/ui';

interface TradeErrorBannerProps {
  message: string;
}

export const TradeErrorBanner = ({ message }: TradeErrorBannerProps) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  ({
    container: {
      backgroundColor: theme.colors.errorSurface,
      borderRadius: theme.radii.lg,
      padding: theme.spacing.md,
    },
    message: {
      color: theme.colors.error,
      fontSize: 14,
    },
  } as const);
