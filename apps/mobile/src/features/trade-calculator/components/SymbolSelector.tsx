import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import type { Symbol } from '@apex-tradebill/types';
import { useTheme, type Theme } from '@apex-tradebill/ui';

const formatDisplaySymbol = (symbol: string): string => {
  return symbol.replace('-', '/');
};

interface SymbolSelectorProps {
  symbols: readonly Symbol[];
  selectedSymbol: Symbol;
  onSelect: (symbol: Symbol) => void;
}

export const SymbolSelector = ({ symbols, selectedSymbol, onSelect }: SymbolSelectorProps) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [isVisible, setIsVisible] = useState(false);

  const open = () => setIsVisible(true);
  const close = () => setIsVisible(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose symbol"
        onPress={open}
        style={styles.trigger}
        testID="symbol-selector.trigger"
      >
        <Text style={styles.triggerLabel}>{formatDisplaySymbol(selectedSymbol)}</Text>
        <Text style={styles.triggerChevron}>▾</Text>
      </Pressable>

      <Modal visible={isVisible} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={close} testID="symbol-selector.backdrop" />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Select Market</Text>
            <ScrollView
              style={styles.optionsScroll}
              contentContainerStyle={styles.optionsContent}
              scrollIndicatorInsets={{ right: 1 }}
            >
              {symbols.map((symbol) => {
                const isSelected = symbol === selectedSymbol;
                return (
                  <Pressable
                    key={symbol}
                    accessibilityRole="button"
                    style={[styles.option, isSelected && styles.optionSelected]}
                    onPress={() => {
                      if (!isSelected) {
                        onSelect(symbol);
                      }
                      close();
                    }}
                    testID={`symbol-selector.option.${symbol}`}
                  >
                    <View style={styles.optionTextGroup}>
                      <Text style={styles.optionTitle}>{formatDisplaySymbol(symbol)}</Text>
                      <Text style={styles.optionSubtitle}>{symbol}</Text>
                    </View>
                    {isSelected ? <View style={styles.optionIndicator} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const createStyles = (theme: Theme) =>
  ({
    trigger: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.divider,
      gap: theme.spacing.xs,
    },
    triggerLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    triggerChevron: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
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
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.radii.xl,
      borderTopRightRadius: theme.radii.xl,
      paddingTop: theme.spacing.lg,
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.xl,
      gap: theme.spacing.lg,
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    optionsScroll: {
      maxHeight: 280,
    },
    optionsContent: {
      gap: theme.spacing.sm,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surfaceMuted,
    },
    optionSelected: {
      borderWidth: 1,
      borderColor: theme.colors.accent,
      backgroundColor: theme.colors.surface,
      ...theme.shadows.level1,
    },
    optionTextGroup: {
      flexDirection: 'column',
      gap: 2,
    },
    optionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    optionSubtitle: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    optionIndicator: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: theme.colors.accent,
    },
  }) as const;
