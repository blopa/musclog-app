import React, { createContext, ReactNode, useContext } from 'react';

import { useTheme } from '@/hooks/useTheme';

/**
 * The background color of the surface a subtree is rendered on.
 *
 * Components that fade content out to "whatever is behind me" (collapsed accordions, scroll
 * shadows) need the real surface color, which is not the screen background when they live inside
 * a sheet or an elevated card. Providing it here keeps that knowledge with the container that
 * owns the surface instead of asking every caller to pass the container's color back down —
 * a duplication that silently breaks the moment the container restyles.
 */
const SurfaceColorContext = createContext<string | null>(null);

export function SurfaceColorProvider({
  color,
  children,
}: {
  color: string;
  children: ReactNode;
}): React.JSX.Element {
  return <SurfaceColorContext.Provider value={color}>{children}</SurfaceColorContext.Provider>;
}

/** The surface color of the nearest provider, defaulting to the screen background. */
export function useSurfaceColor(): string {
  const theme = useTheme();
  return useContext(SurfaceColorContext) ?? theme.colors.background.primary;
}
