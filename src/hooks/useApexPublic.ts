import { useQuery } from '@tanstack/react-query';
import { httpPublic } from '@/lib/http';
import { getEnv } from '@/config/appEnv';

type TickerData = {
  symbol: string;
  lastPrice: string;
  markPrice: string;
  indexPrice: string;
};

export function useTicker(symbol = getEnv().DEFAULT_SYMBOL) {
  return useQuery({
    queryKey: ['ticker', symbol],
    queryFn: async () => {
      const { data } = await httpPublic.get(`/v3/ticker`, { params: { symbol } });
      const item = data?.data?.[0] as any;
      const t: TickerData = {
        symbol: item?.symbol,
        lastPrice: item?.lastPrice,
        markPrice: item?.markPrice,
        indexPrice: item?.indexPrice,
      };
      return t;
    },
    refetchInterval: 4000,
  });
}

