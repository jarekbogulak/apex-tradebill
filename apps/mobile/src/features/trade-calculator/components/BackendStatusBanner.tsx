import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme, type Theme } from '@apex-tradebill/ui';

interface BackendStatusBannerProps {
  onRetry?: () => void;
  disabled?: boolean;
  autoRetryIntervalMs?: number;
}

export const BackendStatusBanner = ({
  onRetry,
  disabled = false,
  autoRetryIntervalMs = 30_000,
}: BackendStatusBannerProps) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const autoSeconds = Math.max(1, Math.round(autoRetryIntervalMs / 1000));

  return (
    <View style={styles.container} testID="backend-status-banner">
      <View style={styles.textBlock}>
        <Text style={styles.title}>Trade history temporarily offline</Text>
        <Text style={styles.message}>
          The API cannot reach its database right now, so history and device sync are paused. Tap
          Retry or wait a few seconds and we’ll check again automatically.
        </Text>
        <Text style={styles.caption}>Automatic retry every {autoSeconds}s.</Text>
      </View>
      {onRetry ? (
        <Pressable
          style={({ pressed }) => [styles.button, (pressed || disabled) && styles.buttonDisabled]}
          disabled={disabled}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry connecting to the server"
        >
          <Text style={styles.buttonLabel}>{disabled ? 'Retrying…' : 'Retry'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  ({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      marginHorizontal: theme.spacing.lg,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.warningSurface,
      gap: theme.spacing.md,
    },
    textBlock: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.warning,
    },
    message: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    caption: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    button: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.textPrimary,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonLabel: {
      color: theme.colors.surface,
      fontWeight: '600',
      fontSize: 14,
    },
  }) as const;

export default BackendStatusBanner;
