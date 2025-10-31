import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, radii, spacing } from '../styles/tokens';

interface TradeBillEmptyCardProps {
  status: 'idle' | 'loading' | 'success' | 'error';
  errorMessage: string | null;
  onCreatePress: () => void;
}

export const TradeBillEmptyCard = ({ status, errorMessage, onCreatePress }: TradeBillEmptyCardProps) => (
  <View style={styles.card}>
    <View style={styles.header}>
      <Text style={styles.sectionTitle}>Trade Bill</Text>
      <Pressable style={styles.primaryButton} onPress={onCreatePress} accessibilityRole="button">
        <Text style={styles.primaryButtonLabel}>Create</Text>
      </Pressable>
    </View>

    <View style={styles.emptyBody}>
      <View style={styles.placeholder}>
        <Text style={styles.placeholderTitle}>No trade calculated yet</Text>
        <Text style={styles.placeholderCopy}>Start a calculation to generate your trade bill.</Text>
      </View>
    </View>

    {status === 'error' && errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.lg,
    shadowColor: palette.shadow,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 18,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  emptyBody: {
    paddingVertical: spacing.lg,
  },
  placeholder: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: palette.surfaceMuted,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: palette.surfaceAlt,
  },
  placeholderTitle: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  placeholderCopy: {
    color: palette.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  errorText: {
    color: palette.textError,
    fontSize: 13,
  },
  primaryButton: {
    backgroundColor: palette.textAccent,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonLabel: {
    color: palette.surface,
    fontSize: 15,
    fontWeight: '600',
  },
});
