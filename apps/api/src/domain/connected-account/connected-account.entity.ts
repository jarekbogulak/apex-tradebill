import { z } from 'zod';

const now = () => new Date().toISOString();

const VenueSchema = z.enum(['apex-omni']);
const StatusSchema = z.enum(['linked', 'revoked', 'error']);

const DecimalStringSchema = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d{1,2})?$/, 'Equity must be a decimal string with up to 2 digits of precision');

export const ConnectedAccountSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  venue: VenueSchema,
  accountId: z.string().trim().min(1),
  status: StatusSchema,
  lastEquity: DecimalStringSchema,
  lastSyncAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ConnectedAccount = z.infer<typeof ConnectedAccountSchema>;
export type ConnectedAccountStatus = z.infer<typeof StatusSchema>;

export interface NewConnectedAccountInput {
  id: string;
  userId: string;
  venue?: z.infer<typeof VenueSchema>;
  accountId: string;
  status?: ConnectedAccountStatus;
  lastEquity?: string;
  lastSyncAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

const DEFAULT_STATUS: ConnectedAccountStatus = 'linked';

export const createConnectedAccount = (input: NewConnectedAccountInput): ConnectedAccount => {
  const issuedAt = input.createdAt ?? now();
  return ConnectedAccountSchema.parse({
    id: input.id,
    userId: input.userId,
    venue: input.venue ?? 'apex-omni',
    accountId: input.accountId,
    status: input.status ?? DEFAULT_STATUS,
    lastEquity: input.lastEquity ?? '0.00',
    lastSyncAt: input.lastSyncAt ?? issuedAt,
    createdAt: issuedAt,
    updatedAt: input.updatedAt ?? issuedAt,
  });
};

const transitionMap: Record<ConnectedAccountStatus, ConnectedAccountStatus[]> = {
  linked: ['revoked', 'error'],
  revoked: [],
  error: ['linked'],
};

export const transitionConnectedAccountStatus = (
  account: ConnectedAccount,
  nextStatus: ConnectedAccountStatus,
): ConnectedAccount => {
  if (account.status === nextStatus) {
    return account;
  }

  const allowed = transitionMap[account.status];
  if (!allowed.includes(nextStatus)) {
    throw new Error(`Invalid connected account status transition: ${account.status} → ${nextStatus}`);
  }

  return ConnectedAccountSchema.parse({
    ...account,
    status: nextStatus,
    updatedAt: now(),
  });
};

export interface UpdateConnectedAccountInput {
  lastEquity?: string;
  lastSyncAt?: string;
  updatedAt?: string;
}

export const updateConnectedAccount = (
  account: ConnectedAccount,
  updates: UpdateConnectedAccountInput,
): ConnectedAccount => {
  if (updates.lastEquity && Number(updates.lastEquity) < 0) {
    throw new Error('Equity cannot be negative');
  }

  return ConnectedAccountSchema.parse({
    ...account,
    ...updates,
    updatedAt: updates.updatedAt ?? now(),
  });
};

export interface ConnectedAccountRepository {
  findById(id: string): Promise<ConnectedAccount | null>;
  findByUserId(userId: string): Promise<ConnectedAccount | null>;
  save(account: ConnectedAccount): Promise<ConnectedAccount>;
}

export const createInMemoryConnectedAccountRepository = (
  seed: ConnectedAccount[] = [],
): ConnectedAccountRepository => {
  const accounts = new Map<string, ConnectedAccount>(seed.map((entry) => [entry.id, entry]));

  return {
    async findById(id) {
      return accounts.get(id) ?? null;
    },
    async findByUserId(userId) {
      for (const account of accounts.values()) {
        if (account.userId === userId) {
          return account;
        }
      }
      return null;
    },
    async save(account) {
      const parsed = ConnectedAccountSchema.parse(account);
      accounts.set(parsed.id, parsed);
      return parsed;
    },
  };
};
