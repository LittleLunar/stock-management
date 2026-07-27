import type { ReactNode } from "react";

/**
 * Passthrough provider for future theming / HeroUI context.
 * HeroUI v3 does not require a root provider today.
 */
export function UiProvider({ children }: { children: ReactNode }) {
  return children;
}
