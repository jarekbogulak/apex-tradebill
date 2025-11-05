import { useCallback, useEffect, useMemo, useState, type MutableRefObject } from 'react';

import type { TradeOutput } from '@apex-tradebill/types';

import {
  type TradeCalculatorInputState,
  useTradeCalculatorStore,
} from '@/src/state/tradeCalculatorStore';

interface UseTradeCalculatorFormStateOptions {
  latestPriceRef: MutableRefObject<string | null>;
  input: TradeCalculatorInputState;
  output: TradeOutput | null;
}

interface FieldHandlers {
  onAccountSizeChange: (value: string) => void;
  onEntryFocus: () => void;
  onEntryBlur: () => void;
  onEntryPriceChange: (value: string) => void;
  onTargetPriceChange: (value: string) => void;
  onStopPriceChange: (value: string) => void;
  onVolatilityToggle: (value: boolean) => void;
  onDirectionChange: (direction: 'long' | 'short') => void;
}

interface UseTradeCalculatorFormStateResult {
  isFormOpen: boolean;
  formMode: 'create' | 'edit';
  fieldHandlers: FieldHandlers;
  openCreate: () => void;
  openEdit: () => void;
  closeForm: () => void;
  syncEntryFromMarket: (price: string | null) => void;
  onManualPreviewSuccess: () => void;
}

export const useTradeCalculatorFormState = ({
  latestPriceRef,
  input,
  output,
}: UseTradeCalculatorFormStateOptions): UseTradeCalculatorFormStateResult => {
  const setInput = useTradeCalculatorStore((state) => state.setInput);
  const setHasManualEntry = useTradeCalculatorStore((state) => state.setHasManualEntry);
  const hasManualEntry = useTradeCalculatorStore((state) => state.hasManualEntry);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>(output ? 'edit' : 'create');
  const [isEntryFocused, setIsEntryFocused] = useState(false);

  useEffect(() => {
    if (!output) {
      setFormMode('create');
    }
  }, [output]);

  const handleAccountSizeChange = useCallback(
    (value: string) => {
      setInput({ accountSize: value });
    },
    [setInput],
  );

  const handleEntryFocus = useCallback(() => {
    setIsEntryFocused(true);
  }, []);

  const handleEntryBlur = useCallback(() => {
    setIsEntryFocused(false);
    if (!hasManualEntry) {
      setInput({ entryPrice: latestPriceRef.current });
    }
  }, [hasManualEntry, latestPriceRef, setInput]);

  const handleEntryPriceChange = useCallback(
    (value: string) => {
      if (value.trim().length === 0) {
        setHasManualEntry(false);
        setInput({ entryPrice: null });
      } else {
        setHasManualEntry(true);
        setInput({ entryPrice: value });
      }
    },
    [setHasManualEntry, setInput],
  );

  const handleTargetPriceChange = useCallback(
    (value: string) => {
      setInput({ targetPrice: value });
    },
    [setInput],
  );

  const handleStopPriceChange = useCallback(
    (value: string) => {
      if (value.trim().length === 0) {
        setInput({ stopPrice: null });
      } else {
        setInput({ stopPrice: value });
      }
    },
    [setInput],
  );

  const handleVolatilityToggle = useCallback(
    (value: boolean) => {
      if (value) {
        setInput({ useVolatilityStop: true, stopPrice: null });
      } else {
        const fallbackStop =
          output?.suggestedStop ?? input.stopPrice ?? latestPriceRef.current ?? '0.00';
        setInput({ useVolatilityStop: false, stopPrice: fallbackStop });
      }
    },
    [input.stopPrice, latestPriceRef, output, setInput],
  );

  const handleDirectionChange = useCallback(
    (direction: 'long' | 'short') => {
      setInput({ direction });
    },
    [setInput],
  );

  const syncEntryFromMarket = useCallback(
    (price: string | null) => {
      if (hasManualEntry || isEntryFocused) {
        return;
      }
      setInput({ entryPrice: price });
    },
    [hasManualEntry, isEntryFocused, setInput],
  );

  const openCreate = useCallback(() => {
    setFormMode('create');
    setIsFormOpen(true);
  }, []);

  const openEdit = useCallback(() => {
    setFormMode('edit');
    setIsFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setIsFormOpen(false);
  }, []);

  const onManualPreviewSuccess = useCallback(() => {
    setFormMode('edit');
    setIsFormOpen(false);
  }, []);

  const fieldHandlers = useMemo<FieldHandlers>(
    () => ({
      onAccountSizeChange: handleAccountSizeChange,
      onEntryFocus: handleEntryFocus,
      onEntryBlur: handleEntryBlur,
      onEntryPriceChange: handleEntryPriceChange,
      onTargetPriceChange: handleTargetPriceChange,
      onStopPriceChange: handleStopPriceChange,
      onVolatilityToggle: handleVolatilityToggle,
      onDirectionChange: handleDirectionChange,
    }),
    [
      handleAccountSizeChange,
      handleDirectionChange,
      handleEntryBlur,
      handleEntryFocus,
      handleEntryPriceChange,
      handleStopPriceChange,
      handleTargetPriceChange,
      handleVolatilityToggle,
    ],
  );

  return {
    isFormOpen,
    formMode,
    fieldHandlers,
    openCreate,
    openEdit,
    closeForm,
    syncEntryFromMarket,
    onManualPreviewSuccess,
  };
};
