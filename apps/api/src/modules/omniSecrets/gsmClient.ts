import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

export interface GsmSecretManagerClientOptions {
  projectId?: string | null;
  logger?: {
    info(message: string, context?: Record<string, unknown>): void;
    warn(message: string, context?: Record<string, unknown>): void;
    error(message: string, context?: Record<string, unknown>): void;
  };
}

export interface SecretFetchResult {
  value: string;
  version: string;
  durationMs: number;
}

export class GsmSecretManagerClient {
  private readonly client: SecretManagerServiceClient;
  private readonly logger: NonNullable<GsmSecretManagerClientOptions['logger']>;

  constructor(private readonly options: GsmSecretManagerClientOptions = {}) {
    this.client = new SecretManagerServiceClient();
    this.logger =
      options.logger ??
      ({
        info: () => {},
        warn: () => {},
        error: () => {},
      } as NonNullable<GsmSecretManagerClientOptions['logger']>);
  }

  async accessSecretVersion(secretResource: string, version: string = 'latest'): Promise<SecretFetchResult> {
    const name = version.startsWith('projects/')
      ? version
      : `${secretResource}/versions/${version}`;
    const startedAt = Date.now();
    try {
      const [response] = await this.client.accessSecretVersion({
        name,
      });
      const durationMs = Date.now() - startedAt;
      const payload = response.payload?.data?.toString() ?? '';
      const resolvedVersion = response.name?.split('/').pop() ?? version;
      return {
        value: payload,
        version: resolvedVersion,
        durationMs,
      };
    } catch (error) {
      this.logger.warn?.('gsm.secret_access_failed', {
        err: error,
        secretResource,
        version,
      });
      throw error;
    }
  }
}
