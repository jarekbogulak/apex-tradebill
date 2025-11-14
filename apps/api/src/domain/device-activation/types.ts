import type { DeviceActivationCode } from '../device-activation-code/device-activation-code.entity.js';
import type { DeviceRegistration } from '../device-registration/device-registration.entity.js';

export interface ActivationPayload {
  version: number;
  codeId: string;
  deviceId: string;
  issuedAt: string;
  expiresAt: string;
  signature: string;
}

export interface RegisterDeviceInput {
  deviceId: string;
  activationCode: string;
  ipAddress?: string;
}

export interface RegisterDeviceResult {
  userId: string;
  deviceId: string;
  token: string;
  tokenExpiresAt: string;
}

export interface ActivationCodeVerifier {
  decode(code: string): ActivationPayload;
  verifySignature(payload: ActivationPayload): void;
}

export interface DeviceActivationRepository {
  getCodeById(codeId: string): Promise<ActivationCodeRecord | null>;
  markCodeConsumed(codeId: string, deviceId: string): Promise<void>;
  getRegistration(deviceId: string): Promise<DeviceRegistrationRecord | null>;
  createUser(userId: string): Promise<void>;
  upsertRegistration(deviceId: string, userId: string): Promise<void>;
  updateRegistrationLastSeen(deviceId: string): Promise<void>;
}

export type ActivationCodeRecord = DeviceActivationCode;
export type DeviceRegistrationRecord = DeviceRegistration;

export interface TokenFactory {
  createToken(payload: TokenPayload): { token: string; expiresAtIso: string };
}

export interface TokenPayload {
  userId: string;
  deviceId: string;
  issuedAtSeconds: number;
  expiresAtSeconds: number;
}
