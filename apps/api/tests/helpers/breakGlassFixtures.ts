import { box, box_keyPair, randomBytes } from 'tweetnacl-ts';

const encoder = new TextEncoder();
const NONCE_LENGTH = 24;

const testKeyPair = box_keyPair();

export const testBreakGlassKeys = {
  publicKeyBase64: Buffer.from(testKeyPair.publicKey).toString('base64'),
  privateKeyBase64: Buffer.from(testKeyPair.secretKey).toString('base64'),
};

export const buildBreakGlassCiphertext = (plaintext: string): string => {
  const nonce = randomBytes(NONCE_LENGTH);
  const ephemeral = box_keyPair();
  const cipher = box(encoder.encode(plaintext), nonce, testKeyPair.publicKey, ephemeral.secretKey);
  if (!cipher) {
    throw new Error('Failed to encrypt break-glass payload for tests.');
  }

  const envelope = {
    version: 1,
    nonce: Buffer.from(nonce).toString('base64'),
    ephemeralPublicKey: Buffer.from(ephemeral.publicKey).toString('base64'),
    ciphertext: Buffer.from(cipher).toString('base64'),
  };

  return Buffer.from(JSON.stringify(envelope)).toString('base64');
};
