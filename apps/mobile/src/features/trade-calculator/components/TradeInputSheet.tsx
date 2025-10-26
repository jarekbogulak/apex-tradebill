import type { ReactNode } from 'react';
import { useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { TradeCalculatorInputState, TradeCalculatorStatus } from '@/src/state/tradeCalculatorStore';

import { palette, radii, spacing } from '../styles/tokens';

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

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} presentationStyle="overFullScreen">
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
                />
                <SegmentButton
                  label="Short"
                  active={input.direction === 'short'}
                  onPress={() => onDirectionChange('short')}
                />
              </View>

              <Field label="Account Size">
                <TextInput
                  value={input.accountSize}
                  keyboardType="decimal-pad"
                  onChangeText={onAccountSizeChange}
                  style={styles.input}
                />
              </Field>

              <Field label="Entry Price">
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

              <Field label="Target Price">
                <TextInput
                  value={input.targetPrice}
                  keyboardType="decimal-pad"
                  onChangeText={onTargetPriceChange}
                  style={styles.input}
                />
              </Field>

              <Field label="Stop Price">
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

              {status === 'error' && errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

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

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    {children}
  </View>
);

const SegmentButton = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
  <Pressable style={[styles.segment, active && styles.segmentActive]} onPress={onPress}>
    <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: palette.surfaceOverlay,
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
    backgroundColor: palette.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 48,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.divider,
    marginBottom: spacing.sm,
  },
  sheetContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  cancelLink: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  cancelLabel: {
    color: palette.textMuted,
    fontWeight: '600',
  },
  label: {
    color: palette.textSecondary,
    fontSize: 14,
  },
  field: {
    gap: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.divider,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: palette.textPrimary,
  },
  inputDisabled: {
    backgroundColor: palette.surfaceMuted,
    color: palette.textMuted,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: palette.textAccent,
    paddingVertical: spacing.lg - 2,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonLabel: {
    color: palette.surface,
    fontSize: 16,
    fontWeight: '600',
  },
  segmentGroup: {
    flexDirection: 'row',
    backgroundColor: palette.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.md - 2,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: palette.textAccent,
  },
  segmentLabel: {
    fontWeight: '600',
    color: palette.textSecondary,
  },
  segmentLabelActive: {
    color: palette.surface,
  },
  errorText: {
    color: palette.textError,
  },
});
