import { z } from 'zod';

const now = () => new Date().toISOString();

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().trim().max(254).nullable().optional(),
  displayName: z.string().trim().min(1).max(64),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;

export interface NewUserInput {
  id: string;
  email?: string | null;
  displayName: string;
  createdAt?: string;
  updatedAt?: string;
}

export const createUser = (input: NewUserInput): User => {
  const issuedAt = input.createdAt ?? now();
  return UserSchema.parse({
    id: input.id,
    email: input.email ?? null,
    displayName: input.displayName,
    createdAt: issuedAt,
    updatedAt: input.updatedAt ?? issuedAt,
  });
};

export interface UpdateUserInput {
  email?: string | null;
  displayName?: string;
  updatedAt?: string;
}

export const updateUser = (user: User, updates: UpdateUserInput): User => {
  return UserSchema.parse({
    ...user,
    ...updates,
    email: updates.email ?? user.email ?? null,
    updatedAt: updates.updatedAt ?? now(),
  });
};

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<User>;
  all(): Promise<User[]>;
}

export const createInMemoryUserRepository = (seed: User[] = []): UserRepository => {
  const users = new Map<string, User>(seed.map((entry) => [entry.id, entry]));

  return {
    async findById(id) {
      return users.get(id) ?? null;
    },
    async findByEmail(email) {
      for (const user of users.values()) {
        if (user.email && user.email.toLowerCase() === email.toLowerCase()) {
          return user;
        }
      }
      return null;
    },
    async save(user) {
      const parsed = UserSchema.parse(user);
      users.set(parsed.id, parsed);
      return parsed;
    },
    async all() {
      return Array.from(users.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
  };
};
