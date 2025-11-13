import type {
  ActivationCodeVerifier,
  DeviceActivationRepository,
  RegisterDeviceInput,
  RegisterDeviceResult,
  TokenFactory,
} from './types.js';

const TOKEN_TTL_DAYS = 30;

export interface RegisterDeviceDeps {
  repository: DeviceActivationRepository;
  activation: ActivationCodeVerifier;
  tokenFactory: TokenFactory;
  now?: () => Date;
  generateUserId: () => string;
  tokenTtlDays?: number;
}

export const makeRegisterDevice = ({
  repository,
  activation,
  tokenFactory,
  now = () => new Date(),
  generateUserId,
  tokenTtlDays = TOKEN_TTL_DAYS,
}: RegisterDeviceDeps) => {
  return async ({
    deviceId,
    activationCode,
  }: RegisterDeviceInput): Promise<RegisterDeviceResult> => {
    const payload = activation.decode(activationCode);
    activation.verifySignature(payload);

    if (payload.deviceId !== deviceId) {
      throw new Error('Activation code does not match device identifier');
    }

    const expiresAtMs = Date.parse(payload.expiresAt);
    if (!Number.isFinite(expiresAtMs) || expiresAtMs < now().getTime()) {
      throw new Error('Activation code has expired');
    }

    const codeRecord = await repository.getCodeById(payload.codeId);
    if (!codeRecord) {
      throw new Error('Activation code is not recognized');
    }

    if (codeRecord.deviceId !== deviceId) {
      throw new Error('Activation code was issued for another device');
    }

    if (codeRecord.signature !== payload.signature) {
      throw new Error('Activation code signature mismatch');
    }

    if (codeRecord.consumedAt != null) {
      throw new Error('Activation code has already been used');
    }

    const dbExpiresAtMs = Date.parse(codeRecord.expiresAt);
    if (!Number.isFinite(dbExpiresAtMs) || dbExpiresAtMs < now().getTime()) {
      throw new Error('Activation code is expired');
    }

    let userId = (await repository.getRegistration(deviceId))?.userId ?? null;

    if (!userId) {
      userId = generateUserId();
      await repository.createUser(userId);
      await repository.upsertRegistration(deviceId, userId);
    } else {
      await repository.updateRegistrationLastSeen(deviceId);
    }

    await repository.markCodeConsumed(payload.codeId, deviceId);

    const issuedAtSeconds = Math.floor(now().getTime() / 1000);
    const expiresAtSeconds = issuedAtSeconds + tokenTtlDays * 24 * 60 * 60;
    const { token, expiresAtIso } = tokenFactory.createToken({
      userId,
      deviceId,
      issuedAtSeconds,
      expiresAtSeconds,
    });

    return {
      userId,
      deviceId,
      token,
      tokenExpiresAt: expiresAtIso,
    };
  };
};
