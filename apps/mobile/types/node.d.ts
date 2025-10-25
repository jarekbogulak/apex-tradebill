declare const __dirname: string;

declare const process: {
  env: Record<string, string | undefined>;
  [key: string]: unknown;
};

declare module 'node:fs' {
  export const readFileSync: (path: string, encoding: string) => string;
  export const existsSync: (path: string) => boolean;
}

declare module 'node:path' {
  export const join: (...segments: string[]) => string;
}
