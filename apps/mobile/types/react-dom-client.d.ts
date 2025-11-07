/// <reference lib="dom" />

declare module 'react-dom/client' {
  import { ReactNode } from 'react';

  interface Root {
    render(children: ReactNode): void;
    unmount(): void;
  }

  interface CreateRootOptions {
    identifierPrefix?: string;
    onRecoverableError?: (error: unknown, info: { componentStack: string }) => void;
  }

  export function createRoot(
    container: Element | DocumentFragment,
    options?: CreateRootOptions,
  ): Root;
}
