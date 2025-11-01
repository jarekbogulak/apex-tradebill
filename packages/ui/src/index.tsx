import type { ReactElement } from 'react';
import { Text } from 'react-native';

export const PlaceholderComponent = (): ReactElement => {
  return <Text>UI components will be exported from @apex-tradebill/ui.</Text>;
};

export * from './theme/index.ts';
