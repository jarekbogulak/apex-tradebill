import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme, type Theme } from '@apex-tradebill/ui';

import { InlineErrorMessage } from '@/components/ui/InlineErrorMessage';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface TradeBillEmptyCardProps {
  status: 'idle' | 'loading' | 'success' | 'error';
  errorMessage: string | null;
  onCreatePress: () => void;
}

export const TradeBillEmptyCard = ({
  status,
  errorMessage,
  onCreatePress,
}: TradeBillEmptyCardProps) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Trade Bill</Text>
        <Pressable style={styles.primaryButton} onPress={onCreatePress} accessibilityRole="button">
          <Text style={styles.primaryButtonLabel}>Create</Text>
        </Pressable>
      </View>

      <View style={styles.emptyBody}>
        <View style={styles.placeholder}>
          <IconSymbol
            name="doc.text"
            size={36}
            weight="semibold"
            color={theme.colors.textMuted}
            style={styles.placeholderIcon}
          />
          <Text style={styles.placeholderTitle}>No trade calculated yet</Text>
          <Text style={styles.placeholderCopy}>
            Start a calculation to generate your trade bill.
          </Text>
        </View>
      </View>

      {status === 'error' && errorMessage ? <InlineErrorMessage message={errorMessage} /> : null}
    </View>
  );
};

const createStyles = (theme: Theme) => {
  const shadow = theme.shadows.level2;

  return {
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.lg,
      padding: theme.spacing.xl,
      gap: theme.spacing.lg,
      ...shadow,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    emptyBody: {
      paddingVertical: theme.spacing.lg,
    },
    placeholder: {
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: theme.colors.surfaceMuted,
      paddingVertical: theme.spacing.xl,
      paddingHorizontal: theme.spacing.lg,
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    placeholderIcon: {
      marginBottom: theme.spacing.xs,
    },
    placeholderTitle: {
      color: theme.colors.textSecondary,
      fontSize: 16,
      fontWeight: '600',
    },
    placeholderCopy: {
      color: theme.colors.textMuted,
      fontSize: 13,
      textAlign: 'center',
    },
    primaryButton: {
      backgroundColor: theme.colors.accent,
      paddingVertical: theme.spacing.sm + 2,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonLabel: {
      color: theme.colors.textInverted,
      fontSize: 15,
      fontWeight: '600',
    },
  } as const;
};
