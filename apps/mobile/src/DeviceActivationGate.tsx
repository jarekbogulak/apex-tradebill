import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { useTheme, type Theme } from '@apex-tradebill/ui';

import { InlineErrorMessage } from '@/components/ui/InlineErrorMessage';
import { createApiClient } from '@/src/services/apiClient';
import { useAuthStore } from '@/src/state/authStore';
import { formatFriendlyError, isApiError } from '@/src/utils/api-error';

const apiClient = createApiClient();

const ACTIVATION_ERROR_FALLBACK =
  'Unable to activate this device right now. Please verify the code and try again.';
const ACTIVATION_FORBIDDEN_MESSAGE =
  'This device is not allowed to register. Please check the code or contact support.';

interface DeviceActivationGateProps {
  children: ReactNode;
}

export const DeviceActivationGate = ({ children }: DeviceActivationGateProps) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const token = useAuthStore((state) => state.token);
  const deviceId = useAuthStore((state) => state.deviceId);
  const ensureDeviceId = useAuthStore((state) => state.ensureDeviceId);
  const setCredentials = useAuthStore((state) => state.setCredentials);
  const clearAuth = useAuthStore((state) => state.clear);
  const tokenExpiresAt = useAuthStore((state) => state.tokenExpiresAt);
  const [hydrated, setHydrated] = useState(() => useAuthStore.persist?.hasHydrated?.() ?? false);

  const [activationCode, setActivationCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated) {
      ensureDeviceId();
    }
  }, [ensureDeviceId, hydrated]);

  useEffect(() => {
    if (hydrated) {
      return;
    }
    const unsub = useAuthStore.persist?.onFinishHydration?.(() => {
      setHydrated(true);
    });
    return () => {
      unsub?.();
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || !token || !tokenExpiresAt) {
      return;
    }

    const expiresAtMs = Date.parse(tokenExpiresAt);
    if (Number.isFinite(expiresAtMs) && Date.now() >= expiresAtMs) {
      console.warn('tradebill.auth.tokenExpired', { tokenExpiresAt });
      clearAuth();
    }
  }, [clearAuth, hydrated, token, tokenExpiresAt]);

  const handleSubmit = useCallback(async () => {
    const trimmed = activationCode.trim();
    if (!trimmed || submitting) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await apiClient.registerDevice({
        deviceId,
        activationCode: trimmed,
      });

      setCredentials({
        token: result.token,
        userId: result.userId,
        deviceId: result.deviceId,
        tokenExpiresAt: result.tokenExpiresAt,
      });
      setActivationCode('');
    } catch (err) {
      if (isApiError(err) && err.status === 403) {
        setErrorMessage(ACTIVATION_FORBIDDEN_MESSAGE);
        return;
      }

      setErrorMessage(formatFriendlyError(err, ACTIVATION_ERROR_FALLBACK));
    } finally {
      setSubmitting(false);
    }
  }, [activationCode, deviceId, setCredentials, submitting]);

  if (!hydrated) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  if (token) {
    return <>{children}</>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Activate This Device</Text>
        <Text style={styles.copy}>
          Provide the activation code issued for the device identifier below to continue.
        </Text>
        <View style={styles.deviceIdBlock}>
          <Text style={styles.deviceIdLabel}>Device ID</Text>
          <Text style={styles.deviceIdValue}>{deviceId}</Text>
        </View>
        <TextInput
          value={activationCode}
          onChangeText={setActivationCode}
          placeholder="Enter activation code"
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          editable={!submitting}
        />
        {errorMessage ? (
          <InlineErrorMessage
            message={errorMessage}
            containerStyle={styles.errorContainer}
          />
        ) : null}
        <Pressable
          style={[
            styles.button,
            (submitting || activationCode.trim().length === 0) && styles.buttonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={submitting || activationCode.trim().length === 0}
        >
          {submitting ? (
            <ActivityIndicator color={theme.colors.textInverted} />
          ) : (
            <Text style={styles.buttonLabel}>Activate</Text>
          )}
        </Pressable>
        <Pressable style={styles.resetButton} onPress={clearAuth} disabled={submitting}>
          <Text style={styles.resetLabel}>Reset device identifier</Text>
        </Pressable>
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: theme.spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  card: {
    width: '100%' as const,
    maxWidth: 420,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.xl,
    gap: theme.spacing.lg,
    ...theme.shadows.level2,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: theme.colors.textPrimary,
  },
  copy: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  deviceIdBlock: {
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.surfaceMuted,
    gap: theme.spacing.xs,
  },
  deviceIdLabel: {
    fontSize: 12,
    textTransform: 'uppercase' as const,
    color: theme.colors.textMuted,
    letterSpacing: 0.6,
  },
  deviceIdValue: {
    fontFamily: 'Courier',
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.surfaceMuted,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: 15,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
  },
  errorContainer: {
    alignSelf: 'stretch' as const,
  },
  button: {
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.accent,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonLabel: {
    color: theme.colors.textInverted,
    fontWeight: '600' as const,
    fontSize: 16,
  },
  resetButton: {
    alignItems: 'center' as const,
    paddingVertical: theme.spacing.sm,
  },
  resetLabel: {
    color: theme.colors.textMuted,
    fontSize: 13,
    textDecorationLine: 'underline' as const,
  },
});

export default DeviceActivationGate;
