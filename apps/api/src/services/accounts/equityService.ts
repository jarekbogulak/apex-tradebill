import type { AccountEquityPort, EquitySnapshot } from '../../domain/ports/tradebillPorts.js';

export interface EquityServiceDeps {
  equityPort: AccountEquityPort;
}

export const createEquityService = ({ equityPort }: EquityServiceDeps) => {
  const getLatestEquity = async (userId: string): Promise<EquitySnapshot> => {
    const snapshot = await equityPort.getEquity(userId);
    if (!snapshot) {
      throw new Error('No equity snapshot available');
    }
    return snapshot;
  };

  const setManualEquity = async (userId: string, equity: string): Promise<EquitySnapshot> => {
    if (Number(equity) < 0) {
      throw new Error('Equity cannot be negative');
    }

    return equityPort.setManualEquity(userId, equity);
  };

  return {
    getLatestEquity,
    setManualEquity,
  };
};
