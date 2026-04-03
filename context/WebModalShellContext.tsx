import type { ReactNode } from 'react';

/**
 * Native: no-op wrapper. Web implementation lives in `WebModalShellContext.web.tsx`.
 */
export function WebModalShellProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useWebModalShellHost(): HTMLElement | null {
  return null;
}
