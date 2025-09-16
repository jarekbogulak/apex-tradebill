import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TradeBillScreen from './screens/TradeBillScreen';
import OrdersScreen from './screens/OrdersScreen';
import SettingsScreen from './screens/SettingsScreen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const Stack = createNativeStackNavigator();
const qc = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="TradeBill" component={TradeBillScreen} options={{ title: 'Trade Bill' }} />
          <Stack.Screen name="Orders" component={OrdersScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </QueryClientProvider>
  );
}

