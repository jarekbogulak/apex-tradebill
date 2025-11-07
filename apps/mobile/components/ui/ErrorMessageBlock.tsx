import { useMemo, type ComponentProps } from 'react';
import { Text, View } from 'react-native';

import { useTheme, type Theme } from '@apex-tradebill/ui';

import { IconSymbol } from '@/components/ui/icon-symbol';

type IconName = ComponentProps<typeof IconSymbol>['name'];

interface ErrorMessageBlockProps {
  title: string;
  message?: string;
  hint?: string;
  iconName?: IconName;
  testID?: string;
}

export const ErrorMessageBlock = ({
  title,
  message,
  hint,
  iconName = 'exclamationmark.triangle',
  testID,
}: ErrorMessageBlockProps) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container} testID={testID}>
      <IconSymbol
        name={iconName}
        size={28}
        weight="semibold"
        color={theme.colors.error}
        style={styles.icon}
      />
      <Text style={styles.title}>{title}</Text>
      {message ? (
        <Text style={styles.message} numberOfLines={3}>
          {message}
        </Text>
      ) : null}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  ({
    container: {
      width: '100%',
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.errorSurface,
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    icon: {
      marginBottom: theme.spacing.xs,
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.error,
    },
    message: {
      fontSize: 13,
      color: theme.colors.error,
    },
    hint: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
  }) as const;
