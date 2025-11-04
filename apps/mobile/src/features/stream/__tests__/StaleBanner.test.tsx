jest.mock('react-native', () => {
  const React = require('react');
  const sanitize = <T extends Record<string, unknown>>(props: T) => {
    const { accessibilityRole, accessibilityLabel, accessibilityLiveRegion, testID, ...rest } =
      props;
    const value = { ...rest } as Record<string, unknown>;
    if (value.style) {
      const flatten = Array.isArray(value.style)
        ? Object.assign({}, ...value.style)
        : { ...value.style };
      for (const key of Object.keys(flatten)) {
        const styleValue = flatten[key as keyof typeof flatten];
        if (typeof styleValue === 'number') {
          flatten[key as keyof typeof flatten] = `${styleValue}px`;
        }
      }
      value.style = flatten;
    }
    if (accessibilityLiveRegion) {
      value['aria-live'] = accessibilityLiveRegion;
    }
    return {
      ...value,
      'data-testid': testID,
      'aria-label': accessibilityLabel,
      role: accessibilityRole,
    };
  };
  return {
    Text: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('span', sanitize(props), children),
    View: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('div', sanitize(props), children),
    Pressable: ({
      children,
      onPress,
      ...props
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
    }) => React.createElement('button', { ...sanitize(props), onClick: onPress }, children),
    StyleSheet: {
      create: (styles: unknown) => styles,
    },
  };
});

import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import StaleBanner from '../StaleBanner.tsx';

describe('StaleBanner', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders stale status with elapsed time and reconnect control', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_700_000_010_000);
    const onReconnect = jest.fn();

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <StaleBanner
          status="stale"
          reconnectAttempts={2}
          lastUpdatedAt={1_700_000_000_000}
          onReconnect={onReconnect}
        />,
      );
    });

    expect(container.querySelector('[data-testid="stream-stale-banner"]')).not.toBeNull();
    expect(container.textContent).toContain('Live data paused. Displaying last known values.');
    expect(container.textContent).toContain('Last update 10s ago.');
    expect(container.textContent).toContain('Reconnect attempt 2');

    const button = container.querySelector(
      '[data-testid="stream-reconnect-button"]',
    ) as HTMLButtonElement;
    button.click();
    expect(onReconnect).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
    container.remove();

    nowSpy.mockRestore();
  });

  it('renders disconnected messaging when stream drops', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_100_000);
    const onReconnect = jest.fn();

    const container = document.createElement('div');
    document.body.appendChild(container);

    const root = createRoot(container);

    await act(async () => {
      root.render(
        <StaleBanner
          status="disconnected"
          reconnectAttempts={0}
          lastUpdatedAt={null}
          onReconnect={onReconnect}
        />,
      );
    });

    expect(container.querySelector('[data-testid="stream-stale-banner"]')).not.toBeNull();
    expect(container.textContent).toContain('Connection lost. Reconnect to resume live updates.');
    expect(container.textContent).toContain('Last update time unknown.');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('hides banner when stream is healthy', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const root = createRoot(container);

    await act(async () => {
      root.render(
        <StaleBanner
          status="connected"
          reconnectAttempts={0}
          lastUpdatedAt={Date.now()}
          onReconnect={jest.fn()}
        />,
      );
    });

    expect(container.querySelector('[data-testid="stream-stale-banner"]')).toBeNull();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
