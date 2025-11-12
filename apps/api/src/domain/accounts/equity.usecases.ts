import type { AccountEquityPort, EquitySnapshot } from '../ports/tradebillPorts.js';

export interface EquityUseCaseDeps {
  equityPort: AccountEquityPort;
}

export const makeGetEquitySnapshot = ({ equityPort }: EquityUseCaseDeps) => {
  return async (userId: string): Promise<EquitySnapshot> => {
    const snapshot = await equityPort.getEquity(userId);
    if (!snapshot) {
      throw new Error('No equity snapshot available');
    }
    return snapshot;
  };
};

export const makeSetManualEquity = ({ equityPort }: EquityUseCaseDeps) => {
  return async (userId: string, equity: string): Promise<EquitySnapshot> => {
    if (Number(equity) < 0) {
      throw new Error('Equity cannot be negative');
    }

    return equityPort.setManualEquity(userId, equity);
  };
};

export type GetEquitySnapshotUseCase = ReturnType<typeof makeGetEquitySnapshot>;
export type SetManualEquityUseCase = ReturnType<typeof makeSetManualEquity>;
