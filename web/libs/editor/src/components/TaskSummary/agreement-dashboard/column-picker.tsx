/**
 * Column visibility picker for the Annotators × Dimensions table.
 *
 * Two independent controls:
 * 1. **Hide unanimous toggle** — hides dimensions where all annotators agree,
 *    applied on top of any column selection mode.
 * 2. **Column selection mode** — radio group:
 *    - Categorical only (default)
 *    - All Dimensions
 *    - Custom Selection (with per-column checkboxes)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cnm, Toggle, Tooltip } from "@humansignal/ui";
import type { ConflictFilter, DimensionInfo } from "./types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ColumnPickerProps {
  /** Total number of all dimensions (categorical + non-categorical) */
  totalDimensionCount: number;
  /** Number of columns currently shown after all filters */
  shownCount: number;
  /** All dimensions (categorical + non-categorical) */
  allDimensions: DimensionInfo[];
  visibleColumnIds: number[];
  onVisibleColumnsChange: (ids: number[]) => void;
  conflictFilter: ConflictFilter;
  onConflictFilterChange: (filter: ConflictFilter) => void;
  /** Whether dimensions with unanimous agreement are hidden */
  conflictsOnly: boolean;
  onConflictsOnlyChange: (value: boolean) => void;
  /** Whether at least one non-categorical dimension exists */
  hasNonCategoricalDimensions: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FILTER_OPTIONS: { value: ConflictFilter; label: string; description: string }[] = [
  { value: "all", label: "Categorical only", description: "Show categorical dimensions" },
  { value: "all_dimensions", label: "All Dimensions", description: "Include non-categorical (spatial/complex) dimensions" },
  { value: "custom", label: "Custom Selection", description: "Choose which columns to display" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ColumnPicker = ({
  totalDimensionCount,
  shownCount,
  allDimensions,
  visibleColumnIds,
  onVisibleColumnsChange,
  conflictFilter,
  onConflictFilterChange,
  conflictsOnly,
  onConflictsOnlyChange,
  hasNonCategoricalDimensions,
}: ColumnPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  const selectedSet = useMemo(() => new Set(visibleColumnIds), [visibleColumnIds]);

  const handleToggleColumn = useCallback(
    (dimensionId: number) => {
      if (selectedSet.has(dimensionId)) {
        onVisibleColumnsChange(visibleColumnIds.filter((id) => id !== dimensionId));
      } else {
        onVisibleColumnsChange([...visibleColumnIds, dimensionId]);
      }
    },
    [selectedSet, visibleColumnIds, onVisibleColumnsChange],
  );

  const handleSelectAll = useCallback(() => {
    onVisibleColumnsChange(allDimensions.map((d) => d.dimensionId));
  }, [allDimensions, onVisibleColumnsChange]);

  const handleSelectNone = useCallback(() => {
    onVisibleColumnsChange([]);
  }, [onVisibleColumnsChange]);

  const isCustom = conflictFilter === "custom";
  const availableFilterOptions = useMemo(
    () => FILTER_OPTIONS.filter((opt) => hasNonCategoricalDimensions || opt.value !== "all_dimensions"),
    [hasNonCategoricalDimensions],
  );

  return (
    <div className="flex items-center gap-tight">
      {/* Color legend */}
      <span className="flex items-center gap-tight text-label-small text-neutral-content-subtle leading-none">
        <span className="inline-flex items-center gap-tighter">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-positive-background border shrink-0" style={{ borderColor: "var(--color-positive-content)" }} />
          <span>Agree</span>
        </span>
        <span className="inline-flex items-center gap-tighter">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-negative-background border shrink-0" style={{ borderColor: "var(--color-negative-content)" }} />
          <span>Conflict</span>
        </span>
      </span>

      {/* Separator */}
      <span className="w-px h-4 bg-neutral-border" />

      {/* Hide unanimous toggle (always visible, outside the dropdown) */}
      <Tooltip title="Hide all columns where all annotators agree">
        <span>
          <Toggle
            label="Hide unanimous"
            checked={conflictsOnly}
            onChange={(e) => onConflictsOnlyChange(e.target.checked)}
          />
        </span>
      </Tooltip>

      {/* Columns dropdown */}
      <div className="relative z-30" ref={containerRef}>
        {/* Trigger button */}
        <Tooltip title={`Configure visible columns, ${shownCount} of ${totalDimensionCount} shown`}>
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-label={`Configure visible columns, ${shownCount} of ${totalDimensionCount} shown`}
            aria-expanded={isOpen}
            className={cnm(
              "flex items-center gap-tight px-tight py-tighter rounded-small border text-label-small cursor-pointer transition-colors",
              isOpen
                ? "bg-primary-background border-primary-border text-primary-content"
                : "bg-neutral-surface border-neutral-border text-neutral-content-subtle hover:bg-neutral-surface-hover",
            )}
          >
            <span aria-hidden>⚙</span>
            <span>
              Columns ({shownCount} of {totalDimensionCount})
            </span>
          </button>
        </Tooltip>

        {/* Dropdown panel */}
        {isOpen && (
          <div
            className="absolute right-0 top-full mt-tighter z-50 w-72 rounded-small border border-neutral-border bg-neutral-surface shadow-lg"
            role="dialog"
            aria-label="Column visibility picker"
          >
            {/* Column selection mode */}
            <div className="p-tight border-b border-neutral-border">
              <span className="text-label-smallest font-semibold text-neutral-content-subtler uppercase tracking-wide">
                Column selection
              </span>
              <div className="mt-tighter">
                {availableFilterOptions.map((opt) => (
                  <label
                    key={opt.value}
                    className={cnm(
                      "flex items-start gap-tight px-tight py-tighter rounded-small cursor-pointer transition-colors",
                      conflictFilter === opt.value
                        ? "bg-primary-background"
                        : "hover:bg-neutral-surface-hover",
                    )}
                  >
                    <input
                      type="radio"
                      name="column-filter-mode"
                      value={opt.value}
                      checked={conflictFilter === opt.value}
                      onChange={() => onConflictFilterChange(opt.value)}
                      className="mt-0.5 accent-primary-content"
                    />
                    <div>
                      <span
                        className={cnm(
                          "text-label-small font-medium",
                          conflictFilter === opt.value ? "text-primary-content" : "text-neutral-content",
                        )}
                      >
                        {opt.label}
                      </span>
                      <p className="text-label-smallest text-neutral-content-subtler">{opt.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Per-column toggles (only when "custom" is selected) */}
            {isCustom && allDimensions.length > 0 && (
              <div className="p-tight">
                <div className="flex items-center justify-between mb-tighter">
                  <span className="text-label-smallest font-semibold text-neutral-content-subtler uppercase tracking-wide">
                    Columns
                  </span>
                  <div className="flex gap-tight">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-label-smallest text-primary-content hover:underline cursor-pointer"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectNone}
                      className="text-label-smallest text-primary-content hover:underline cursor-pointer"
                    >
                      None
                    </button>
                  </div>
                </div>
                <div className="overflow-y-auto" style={{ maxHeight: "min(40vh, 400px)" }}>
                  {allDimensions.map((dim) => {
                    const isSelected = selectedSet.has(dim.dimensionId);
                    return (
                      <label
                        key={dim.dimensionId}
                        className="flex items-center gap-tight px-tight py-tighter rounded-small cursor-pointer hover:bg-neutral-surface-hover transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleColumn(dim.dimensionId)}
                          className="rounded border-neutral-border accent-primary-content"
                        />
                        <span className="text-label-small text-neutral-content">{dim.name}</span>
                        {dim.controlTag && (
                          <span className="bg-primary-background text-primary-content rounded px-tight h-5 flex items-center justify-center border border-primary-border-subtler text-label-smallest">
                            {dim.controlTag}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
