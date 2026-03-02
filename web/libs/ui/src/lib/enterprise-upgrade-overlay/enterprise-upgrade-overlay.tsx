import { forwardRef, type ReactNode } from "react";

export interface EnterpriseUpgradeOverlayProps {
  title?: ReactNode;
  description?: ReactNode;
  feature?: string;
  learnMoreUrl?: string;
  primaryButtonLabel?: string;
  secondaryButtonLabel?: string;
  showLearnMore?: boolean;
  onContactSales?: () => void;
  onLearnMore?: () => void;
  className?: string;
  "data-testid"?: string;
}

/**
 * EnterpriseUpgradeOverlay - White-labeled to render nothing.
 * All enterprise upgrade overlay references across the app will render empty.
 */
export const EnterpriseUpgradeOverlay = forwardRef<HTMLDivElement, EnterpriseUpgradeOverlayProps>(
  (_props, _ref) => {
    return null;
  },
);

EnterpriseUpgradeOverlay.displayName = "EnterpriseUpgradeOverlay";

export default EnterpriseUpgradeOverlay;
