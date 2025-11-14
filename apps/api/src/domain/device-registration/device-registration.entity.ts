import { z } from 'zod';

const now = () => new Date().toISOString();

export const DeviceRegistrationSchema = z.object({
  deviceId: z.string().trim().min(1),
  userId: z.string().uuid(),
  registeredAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
});

export type DeviceRegistration = z.infer<typeof DeviceRegistrationSchema>;

export interface NewDeviceRegistrationInput {
  deviceId: string;
  userId: string;
  registeredAt?: string;
  lastSeenAt?: string;
}

export const createDeviceRegistration = (
  input: NewDeviceRegistrationInput,
): DeviceRegistration => {
  const registeredAt = input.registeredAt ?? now();
  return DeviceRegistrationSchema.parse({
    deviceId: input.deviceId,
    userId: input.userId,
    registeredAt,
    lastSeenAt: input.lastSeenAt ?? registeredAt,
  });
};

export const touchDeviceRegistration = (
  registration: DeviceRegistration,
  timestamp: string = now(),
): DeviceRegistration => {
  return DeviceRegistrationSchema.parse({
    ...registration,
    lastSeenAt: timestamp,
  });
};
