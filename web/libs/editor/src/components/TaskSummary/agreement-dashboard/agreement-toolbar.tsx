/**
 * Toolbar for the agreement dashboard.
 *
 * Contains controls for dashboard panel visibility.
 * Column visibility is managed by the ColumnPicker placed near the table.
 */

import { useCallback, useMemo } from "react";
import { cnm } from "@humansignal/ui";
import type { PanelId } from "./types";
import { PANEL_IDS, PANEL_LABELS } from "./types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AgreementToolbarProps {
  visiblePanels: PanelId[];
  onVisiblePanelsChange: (panels: PanelId[]) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const AgreementToolbar = ({
  visiblePanels,
  onVisiblePanelsChange,
}: AgreementToolbarProps) => {
  const panelOptions = useMemo(
    () =>
      PANEL_IDS.map((id) => ({
        value: id,
        label: PANEL_LABELS[id],
      })),
    [],
  );

  const handlePanelChange = useCallback(
    (selected: string | string[]) => {
      const panels = (Array.isArray(selected) ? selected : [selected]) as PanelId[];
      // Ensure at least one panel stays visible
      if (panels.length === 0) return;
      onVisiblePanelsChange(panels);
    },
    [onVisiblePanelsChange],
  );

  return (
    <div className="flex flex-wrap items-center gap-base mb-base py-tight px-base rounded-small border border-neutral-border bg-neutral-surface-subtle">
      {/* Dashboard Panel Visibility */}
      <div className="flex items-center gap-tight">
        <span className="text-label-small font-semibold text-neutral-content-subtle">Panels</span>
        <div className="flex flex-wrap gap-tighter">
          {panelOptions.map((opt) => {
            const isVisible = visiblePanels.includes(opt.value as PanelId);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  if (isVisible) {
                    const next = visiblePanels.filter((p) => p !== opt.value);
                    if (next.length > 0) handlePanelChange(next);
                  } else {
                    handlePanelChange([...visiblePanels, opt.value]);
                  }
                }}
                className={cnm(
                  "px-tight py-tighter rounded-small text-label-small border transition-colors cursor-pointer",
                  isVisible
                    ? "bg-primary-background border-primary-border text-primary-content"
                    : "bg-neutral-surface border-neutral-border text-neutral-content-subtle",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
