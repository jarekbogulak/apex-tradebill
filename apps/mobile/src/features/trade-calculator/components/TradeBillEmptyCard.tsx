import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, radii, spacing } from '../styles/tokens';

interface TradeBillEmptyCardProps {
  status: 'idle' | 'loading' | 'success' | 'error';
  errorMessage: string | null;
  onCreatePress: () => void;
}

export const TradeBillEmptyCard = ({ status, errorMessage, onCreatePress }: TradeBillEmptyCardProps) => (
  <View style={styles.card}>
    <Text style={styles.sectionTitle}>Trade Bill</Text>
    <Text style={styles.emptyState}>Create a trade to see position sizing details.</Text>
    {status === 'error' && errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
    <Pressable style={styles.primaryButton} onPress={onCreatePress}>
      <Text style={styles.primaryButtonLabel}>Create Trade</Text>
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: palette.shadow,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 10,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  emptyState: {
    color: palette.textMuted,
  },
  errorText: {
    color: palette.textError,
  },
  primaryButton: {
    backgroundColor: palette.textAccent,
    paddingVertical: spacing.lg - 2,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonLabel: {
    color: palette.surface,
    fontSize: 16,
    fontWeight: '600',
  },
});
