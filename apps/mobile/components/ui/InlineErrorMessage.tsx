import { useMemo } from 'react';
import { Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { useTheme, type Theme } from '@apex-tradebill/ui';

type TextAlign = 'left' | 'center' | 'right';

interface InlineErrorMessageProps {
  message: string;
  align?: TextAlign;
  maxLines?: number;
  testID?: string;
  containerStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const InlineErrorMessage = ({
  message,
  align = 'center',
  maxLines,
  testID,
  containerStyle,
  textStyle,
}: InlineErrorMessageProps) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const alignment = useMemo(() => getAlignmentStyles(align), [align]);

  return (
    <View style={[styles.container, alignment.container, containerStyle]} testID={testID}>
      <Text
        style={[styles.text, alignment.text, textStyle]}
        numberOfLines={typeof maxLines === 'number' ? maxLines : undefined}
      >
        {message}
      </Text>
    </View>
  );
};

const getAlignmentStyles = (
  align: TextAlign,
): { container: ViewStyle; text: Pick<TextStyle, 'textAlign'> } => {
  switch (align) {
    case 'left':
      return {
        container: { alignItems: 'flex-start', alignSelf: 'stretch' },
        text: { textAlign: 'left' },
      };
    case 'right':
      return {
        container: { alignItems: 'flex-end', alignSelf: 'flex-end' },
        text: { textAlign: 'right' },
      };
    case 'center':
    default:
      return {
        container: { alignItems: 'center', alignSelf: 'center' },
        text: { textAlign: 'center' },
      };
  }
};

const createStyles = (theme: Theme) =>
  ({
    container: {
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.errorSurface,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      maxWidth: '100%',
    },
    text: {
      color: theme.colors.error,
      fontSize: 13,
      fontWeight: '600',
    },
  }) as const;
