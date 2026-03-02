import type { FC } from "react";

/* eslint-disable-next-line */
export interface EnterpriseBadgeProps {
  className?: string;
  filled?: boolean;
  compact?: boolean;
  ghost?: boolean;
}

/**
 * EnterpriseBadge - White-labeled to render nothing.
 * All enterprise badge references across the app will render empty.
 */
export const EnterpriseBadge: FC<EnterpriseBadgeProps> = () => {
  return null;
};

export default EnterpriseBadge;
