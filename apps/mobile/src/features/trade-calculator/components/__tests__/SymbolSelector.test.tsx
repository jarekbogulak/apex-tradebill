/* eslint-disable react/display-name */

jest.mock('react-native', () => {
  const React = require('react');

  const wrapHost =
    (tag: string) =>
    ({ children, testID, ...props }: { children?: React.ReactNode; testID?: string }) =>
      React.createElement(tag, { ...props, 'data-testid': testID }, children);

  const View = wrapHost('div');
  const Text = wrapHost('span');
  const ScrollView = wrapHost('div');

  const Pressable = ({
    children,
    onPress,
    testID,
    ...props
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
    testID?: string;
  }) =>
    React.createElement('button', { ...props, 'data-testid': testID, onClick: onPress }, children);

  const Modal = ({
    children,
    visible = true,
    testID,
  }: {
    children?: React.ReactNode;
    visible?: boolean;
    testID?: string;
  }) => {
    if (!visible) {
      return null;
    }
    return React.createElement('div', { 'data-testid': testID }, children);
  };

  Pressable.displayName = 'MockPressable';
  ScrollView.displayName = 'MockScrollView';
  View.displayName = 'MockView';
  Text.displayName = 'MockText';
  Modal.displayName = 'MockModal';

  return {
    Pressable,
    ScrollView,
    View,
    Text,
    Modal,
  };
});

import TestRenderer, { act } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';

import type { Symbol } from '@apex-tradebill/types';

import { SymbolSelector } from '../SymbolSelector.js';

const SYMBOLS = ['BTC-USDT', 'ETH-USDT'] as Symbol[];

describe('SymbolSelector', () => {
  test('renders current selection and allows switching symbols', () => {
    const handleSelect = jest.fn();

    let renderer: ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <SymbolSelector symbols={SYMBOLS} selectedSymbol="BTC-USDT" onSelect={handleSelect} />,
      );
    });

    const findByTestID = (testID: string) =>
      renderer.root.find((node) => node.props?.testID === testID);
    const findAllByTestID = (testID: string) =>
      renderer.root.findAll((node) => node.props?.testID === testID);

    const trigger = findByTestID('symbol-selector.trigger');
    const triggerChildren = Array.isArray(trigger.props.children)
      ? trigger.props.children
      : [trigger.props.children];
    const triggerLabel = triggerChildren.find((child) => child?.props?.children === 'BTC/USDT');
    expect(triggerLabel).toBeTruthy();

    act(() => {
      findByTestID('symbol-selector.trigger').props.onPress();
    });

    act(() => {
      findByTestID('symbol-selector.option.BTC-USDT').props.onPress();
    });

    expect(handleSelect).not.toHaveBeenCalled();
    expect(findAllByTestID('symbol-selector.option.BTC-USDT')).toHaveLength(0);

    act(() => {
      findByTestID('symbol-selector.trigger').props.onPress();
    });
    act(() => {
      findByTestID('symbol-selector.option.ETH-USDT').props.onPress();
    });

    expect(handleSelect).toHaveBeenCalledWith('ETH-USDT');
  });
});
