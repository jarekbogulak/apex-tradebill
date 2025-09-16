import { useMutation } from '@tanstack/react-query';
import { httpPrivate } from '@/lib/http';
import qs from 'qs';
import { getEnv } from '@/config/appEnv';
import { signOrderZk } from '@/lib/apexSign';

export async function getWorstPrice(params: { symbolDash: string; side: 'BUY'|'SELL'; size: string }) {
  const url = `/v3/get-worst-price?size=${params.size}&symbol=${params.symbolDash}&side=${params.side}`;
  const { data } = await httpPrivate.get(url);
  return data?.worstPrice || data?.data?.worstPrice;
}

export type CreateOrderInput = {
  symbolDash: string; // e.g. BTC-USDT
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  size: string;       // base units as string
  price: string;      // required even for MARKET per ApeX
  limitFee?: string;  // e.g., "0.001"
  timeInForce?: 'GOOD_TIL_CANCEL' | 'FILL_OR_KILL' | 'IMMEDIATE_OR_CANCEL';
  clientOrderId?: string;
};

export async function createOrder(input: CreateOrderInput) {
  const expirationHours = Math.floor((Date.now() + 28*24*60*60*1000) / 3600000); // recommended
  const signatureL2 = signOrderZk(
    JSON.stringify({ ...input, expiration: expirationHours }),
    getEnv().APEX_L2_KEY
  );

  const body = {
    symbol: input.symbolDash,
    side: input.side,
    type: input.type,
    size: input.size,
    price: input.price,
    limitFee: input.limitFee ?? '0.002',
    expiration: expirationHours * 3600000, // adjust if API expects seconds vs ms per doc
    timeInForce: input.timeInForce ?? 'IMMEDIATE_OR_CANCEL',
    clientOrderId: input.clientOrderId ?? `mob-${Date.now()}`,
    signature: signatureL2 || '0x', // placeholder if needed by your account policy
    reduceOnly: 'false',
  } as const;

  const { data } = await httpPrivate.post('/v3/order', qs.stringify(body));
  return data;
}

export function usePlaceOrder() {
  return useMutation({
    mutationFn: createOrder,
  });
}

