import { z } from 'zod';

const now = () => new Date().toISOString();

export const DeviceActivationCodeSchema = z.object({
  id: z.string().uuid(),
  deviceId: z.string().trim().min(1),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  signature: z.string().trim().min(1),
  consumedAt: z.string().datetime().nullable(),
  consumedByDevice: z.string().trim().min(1).nullable(),
  createdAt: z.string().datetime(),
});

export type DeviceActivationCode = z.infer<typeof DeviceActivationCodeSchema>;

export interface NewDeviceActivationCodeInput {
  id: string;
  deviceId: string;
  issuedAt: string;
  expiresAt: string;
  signature: string;
  createdAt?: string;
  consumedAt?: string | null;
  consumedByDevice?: string | null;
}

export const createDeviceActivationCode = (
  input: NewDeviceActivationCodeInput,
): DeviceActivationCode => {
  return DeviceActivationCodeSchema.parse({
    id: input.id,
    deviceId: input.deviceId,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    signature: input.signature,
    consumedAt: input.consumedAt ?? null,
    consumedByDevice: input.consumedByDevice ?? null,
    createdAt: input.createdAt ?? now(),
  });
};

export const markDeviceActivationCodeConsumed = (
  code: DeviceActivationCode,
  deviceId: string,
  timestamp: string = now(),
): DeviceActivationCode => {
  return DeviceActivationCodeSchema.parse({
    ...code,
    consumedAt: timestamp,
    consumedByDevice: deviceId,
  });
};
