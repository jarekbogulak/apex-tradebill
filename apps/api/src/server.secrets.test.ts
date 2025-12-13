import Fastify from 'fastify';

describe('Logger Redaction', () => {
  let loggedMessages: unknown[] = [];

  // Custom writable stream to capture logs
  const captureStream = {
    write: (msg: string) => {
      loggedMessages.push(JSON.parse(msg));
    },
  };

  afterEach(() => {
    loggedMessages = [];
    jest.clearAllMocks();
  });

  it('should redact sensitive keys in nested objects', async () => {
    // We recreate the Redaction configuration login from server.ts to specifically test it
    // because spying on the full app logger stream is complex in this setup.
    // However, the best way is to unit test the configuration or instantiation.
    // Let's attempt to use the actual app instance but force a stream we can read.
    
    // We need to manipulate how 'pino' is instantiated or passed to Fastify.
    // Since server.ts instantiates Fastify inside buildServer, we can't easily inject the stream 
    // UNLESS we modify buildServer to accept logger options, which it doesn't currently expose fully.
    
    // ALTERNATIVE: We can instantiate a fastify instance with the SAME logic as server.ts to verify the config.
    // This duplicates the config but verifies the *list* of paths works.
    
    const redactedLogPaths = [
        'req.headers.apex-api-key',
        'req.headers.apex-signature',
        'req.headers.apex-passphrase',
        'req.headers.apex-omni-api-key',
        'req.headers.apex-omni-api-secret',
        'req.headers.apex-omni-api-passphrase',
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers.omni-breakglass-token',
        'req.headers.omni-ops-token',
        'body.apexOmni.apiSecret',
        'body.apexOmni.apiKey',
        'body.apexOmni.passphrase',
        'body.apexOmni.l2Seed',
        // New OneS
        '*.jwtSecret',
        '*.breakglassPrivateKey',
        '*.omniBreakglassPrivateKey',
        '*.apiSecret',
        '*.credentials.apiSecret',
        '*.passphrase',
        // Top-level redaction
        'jwtSecret',
        'breakglassPrivateKey',
        'omniBreakglassPrivateKey',
        'apiSecret',
        'passphrase',
      ];

      const instance = Fastify({
        logger: {
            level: 'info',
            stream: captureStream,
            redact: {
                paths: redactedLogPaths,
                remove: true,
            }
        }
      });

      const sensitiveData = {
        userData: {
            jwtSecret: 'super-secret-jwt',
            breakglassPrivateKey: 'private-key-material',
            other: 'safe-value'
        },
        credentials: {
            apiSecret: 'my-api-secret',
            passphrase: 'my-passphrase'
        },
        omniBreakglassPrivateKey: 'raw-key'
      };

      instance.log.info({ ...sensitiveData }, 'Log with secrets');

      expect(loggedMessages.length).toBeGreaterThan(0);
      const logEntry = loggedMessages[0];
      
      expect(logEntry.userData).toBeDefined();
      expect(logEntry.userData.other).toBe('safe-value');
      
      // Secrets should be missing
      expect(logEntry.userData.jwtSecret).toBeUndefined();
      expect(logEntry.userData.breakglassPrivateKey).toBeUndefined();
      expect(logEntry.credentials.apiSecret).toBeUndefined();
      expect(logEntry.credentials.passphrase).toBeUndefined();
      // Wait, *.credentials.apiSecret means apiSecret INSIDE credentials.
      // If we use wildcard, it should just remove the leaf.
      
      // Let's check specifics based on pino documentation
      // *.apiSecret should remove apiSecret key anywhere at that level? No, * is one level wildcard.
      // actually pino redaction syntax: 
      // 'a.b.c' -> specific path
      // '*.b.c' -> b.c property of ANY top level property
      
      // Checking our expectations against pino behavior.
      expect(logEntry.omniBreakglassPrivateKey).toBeUndefined();
  });
});
