import { StyleSheet, Text, View } from 'react-native';

import { palette, radii, spacing } from '../styles/tokens';

interface TradeErrorBannerProps {
  message: string;
}

export const TradeErrorBanner = ({ message }: TradeErrorBannerProps) => (
  <View style={styles.container}>
    <Text style={styles.message}>{message}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.errorBackground,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  message: {
    color: palette.textError,
    fontSize: 14,
  },
});
