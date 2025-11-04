import type { ReactNode } from 'react';
import { useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useTheme, type Theme } from '@apex-tradebill/ui';

import type {
  TradeCalculatorInputState,
  TradeCalculatorStatus,
} from '@/src/state/tradeCalculatorStore';

interface TradeInputSheetProps {
  visible: boolean;
  mode: 'create' | 'edit';
  input: TradeCalculatorInputState;
  marketPlaceholder: string;
  onClose: () => void;
  onSubmit: () => void;
  onAccountSizeChange: (value: string) => void;
  onEntryFocus: () => void;
  onEntryBlur: () => void;
  onEntryPriceChange: (value: string) => void;
  onTargetPriceChange: (value: string) => void;
  onStopPriceChange: (value: string) => void;
  onVolatilityToggle: (value: boolean) => void;
  onDirectionChange: (direction: 'long' | 'short') => void;
  isSubmitting: boolean;
  status: TradeCalculatorStatus;
  errorMessage: string | null;
}

/**
 * Sliding sheet that encapsulates all trade input fields and adapts for manual or
 * live preview submission flows.
 */
export const TradeInputSheet = ({
  visible,
  mode,
  input,
  marketPlaceholder,
  onClose,
  onSubmit,
  onAccountSizeChange,
  onEntryFocus,
  onEntryBlur,
  onEntryPriceChange,
  onTargetPriceChange,
  onStopPriceChange,
  onVolatilityToggle,
  onDirectionChange,
  isSubmitting,
  status,
  errorMessage,
}: TradeInputSheetProps) => {
  const title = mode === 'edit' ? 'Edit Trade' : 'New Trade';
  const actionLabel = isSubmitting ? 'Working…' : 'Done';
  const keyboardBehavior = useMemo(
    () => Platform.select<'padding' | 'height' | undefined>({ ios: 'padding', android: 'height' }),
    [],
  );
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            if (!isSubmitting) {
              onClose();
            }
          }}
        />
        <KeyboardAvoidingView behavior={keyboardBehavior} style={styles.keyboardContainer}>
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <ScrollView
              contentContainerStyle={styles.sheetContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.headerRow}>
                <Text style={styles.title}>{title}</Text>
                <Pressable style={styles.cancelLink} onPress={onClose} disabled={isSubmitting}>
                  <Text style={styles.cancelLabel}>Cancel</Text>
                </Pressable>
              </View>

              <Text style={styles.label}>Direction</Text>
              <View style={styles.segmentGroup}>
                <SegmentButton
                  label="Long"
                  active={input.direction === 'long'}
                  onPress={() => onDirectionChange('long')}
                  styles={styles}
                />
                <SegmentButton
                  label="Short"
                  active={input.direction === 'short'}
                  onPress={() => onDirectionChange('short')}
                  styles={styles}
                />
              </View>

              <Field label="Account Size" styles={styles}>
                <TextInput
                  value={input.accountSize}
                  keyboardType="decimal-pad"
                  onChangeText={onAccountSizeChange}
                  style={styles.input}
                />
              </Field>

              <Field label="Entry Price" styles={styles}>
                <TextInput
                  value={input.entryPrice ?? ''}
                  keyboardType="decimal-pad"
                  placeholder={marketPlaceholder}
                  onFocus={onEntryFocus}
                  onBlur={onEntryBlur}
                  onChangeText={onEntryPriceChange}
                  style={styles.input}
                />
              </Field>

              <Field label="Target Price" styles={styles}>
                <TextInput
                  value={input.targetPrice}
                  keyboardType="decimal-pad"
                  onChangeText={onTargetPriceChange}
                  style={styles.input}
                />
              </Field>

              <Field label="Stop Price" styles={styles}>
                <TextInput
                  value={input.stopPrice ?? ''}
                  keyboardType="decimal-pad"
                  editable={!input.useVolatilityStop}
                  placeholder={input.useVolatilityStop ? 'ATR auto-stop' : undefined}
                  onChangeText={onStopPriceChange}
                  style={[styles.input, input.useVolatilityStop && styles.inputDisabled]}
                />
              </Field>

              <View style={styles.switchRow}>
                <Text style={styles.label}>Use Volatility Stop</Text>
                <Switch value={input.useVolatilityStop} onValueChange={onVolatilityToggle} />
              </View>

              {status === 'error' && errorMessage ? (
                <Text style={styles.errorText}>{errorMessage}</Text>
              ) : null}

              <Pressable
                style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}
                onPress={onSubmit}
                disabled={isSubmitting}
              >
                <Text style={styles.primaryButtonLabel}>{actionLabel}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const Field = ({
  label,
  children,
  styles,
}: {
  label: string;
  children: ReactNode;
  styles: ReturnType<typeof createStyles>;
}) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    {children}
  </View>
);

const SegmentButton = ({
  label,
  active,
  onPress,
  styles,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) => (
  <Pressable style={[styles.segment, active && styles.segmentActive]} onPress={onPress}>
    <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{label}</Text>
  </Pressable>
);

const createStyles = (theme: Theme) =>
  ({
    overlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: 'flex-end',
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    keyboardContainer: {
      width: '100%',
    },
    sheetContainer: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.radii.xl,
      borderTopRightRadius: theme.radii.xl,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.xl,
    },
    sheetHandle: {
      alignSelf: 'center',
      width: 48,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.divider,
      marginBottom: theme.spacing.sm,
    },
    sheetContent: {
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.lg,
      gap: theme.spacing.lg,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    cancelLink: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    cancelLabel: {
      color: theme.colors.textMuted,
      fontWeight: '600',
    },
    label: {
      color: theme.colors.textSecondary,
      fontSize: 14,
    },
    field: {
      gap: theme.spacing.xs,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.divider,
      borderRadius: theme.radii.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      fontSize: 16,
      color: theme.colors.textPrimary,
      backgroundColor: theme.colors.surface,
    },
    inputDisabled: {
      backgroundColor: theme.colors.surfaceMuted,
      color: theme.colors.textMuted,
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    primaryButton: {
      backgroundColor: theme.colors.accent,
      paddingVertical: theme.spacing.lg - 2,
      borderRadius: theme.radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonDisabled: {
      opacity: 0.6,
    },
    primaryButtonLabel: {
      color: theme.colors.textInverted,
      fontSize: 16,
      fontWeight: '600',
    },
    segmentGroup: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radii.md,
      padding: theme.spacing.xs,
      gap: theme.spacing.xs,
    },
    segment: {
      flex: 1,
      paddingVertical: theme.spacing.md - 2,
      borderRadius: theme.radii.md,
      alignItems: 'center',
    },
    segmentActive: {
      backgroundColor: theme.colors.accent,
    },
    segmentLabel: {
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    segmentLabelActive: {
      color: theme.colors.textInverted,
    },
    errorText: {
      color: theme.colors.error,
    },
  }) as const;
