/**
 * Ground Truth Row — interactive adjudication row in the Annotators × Dimensions table.
 *
 * Rendered below the Majority Vote row. Each cell can be in one of three states:
 * - Auto-resolved (green check) — filled by auto-accept, click to override
 * - Pending (amber, dropdown trigger) — needs reviewer decision
 * - Manually set (blue check) — reviewer made explicit choice
 *
 * Uses the builtin Select component from @humansignal/ui for the value picker,
 * which portals its dropdown to the document body to avoid overflow clipping.
 */

import { useCallback, useMemo } from "react";
import { cnm, Tooltip, Select } from "@humansignal/ui";
import { IconStar, IconCheckBold } from "@humansignal/icons";
import type { DimensionInfo, GroundTruthCell, GroundTruthSource } from "./types";
import type { ValueCount } from "./use-ground-truth";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GroundTruthRowProps {
  dimensions: DimensionInfo[];
  cells: Map<number, GroundTruthCell>;
  valueCounts: Map<number, ValueCount[]>;
  onSetCell: (dimensionId: number, value: string | number | boolean | null, source?: GroundTruthSource) => void;
  onClearCell: (dimensionId: number) => void;
}

// ---------------------------------------------------------------------------
// Single ground truth cell
// ---------------------------------------------------------------------------

interface GroundTruthCellComponentProps {
  dimension: DimensionInfo;
  cell: GroundTruthCell | undefined;
  options: ValueCount[];
  onSetCell: (value: string | number | boolean | null, source?: GroundTruthSource) => void;
}

const GroundTruthCellComponent = ({ dimension, cell, options, onSetCell }: GroundTruthCellComponentProps) => {
  // Build Select-compatible options from ValueCount[]
  const selectOptions = useMemo(
    () =>
      options.map((opt) => ({
        value: String(opt.value),
        label: `${String(opt.value)} (${opt.count})`,
      })),
    [options],
  );

  // Map selected string back to original typed value
  const handleChange = useCallback(
    (val: string) => {
      const original = options.find((o) => String(o.value) === val);
      onSetCell(original ? original.value : val, "manual");
    },
    [options, onSetCell],
  );

  // Non-categorical dimensions are not editable
  if (!dimension.isCategorical) {
    return (
      <td className="px-4 py-2.5 align-middle text-label-small text-neutral-content-subtler italic border-t-2 border-neutral-border-bold">
        N/A
      </td>
    );
  }

  const isResolved = !!cell;
  const isAutoResolved = cell?.source === "auto_unanimous" || cell?.source === "auto_majority";

  const bgClass = !isResolved
    ? ""
    : isAutoResolved
      ? "bg-positive-background"
      : "bg-primary-background";

  const bgStyle = !isResolved
    ? { backgroundColor: "var(--color-warning-background, #FFF8E1)" }
    : undefined;

  const tooltipText = isResolved
    ? isAutoResolved
      ? `Auto-accepted (${cell.source === "auto_unanimous" ? "unanimous" : "majority"}). Click to override.`
      : "Manually set. Click to change."
    : undefined;

  const selectEl = (
    <Select
      options={selectOptions}
      value={isResolved ? String(cell.value) : undefined}
      onChange={handleChange as any}
      placeholder="Select"
      size={"small" as any}
      triggerClassName="!bg-transparent !border-none !shadow-none !px-0 !py-0 !h-6 !min-h-0 !w-auto !gap-tightest [&>svg]:!w-3 [&>svg]:!h-3"
      renderSelected={(selectedOptions?: any[], placeholder?: string) => {
        if (!isResolved || !selectedOptions?.length) {
          return (
            <span className="text-warning-content text-label-small cursor-pointer">
              {placeholder}
            </span>
          );
        }
        return (
          <span
            className={cnm(
              "flex items-center gap-tighter text-label-small font-medium",
              isAutoResolved ? "text-positive-content" : "text-primary-content",
            )}
          >
            <IconCheckBold width={14} height={14} />
            <span>{String(cell.value)}</span>
          </span>
        );
      }}
    />
  );

  return (
    <td
      className={cnm(
        "px-4 py-2.5 align-middle text-label-small border-t-2 border-neutral-border-bold",
        bgClass,
      )}
      style={bgStyle}
    >
      {tooltipText ? (
        <Tooltip title={tooltipText}>
          <div>{selectEl}</div>
        </Tooltip>
      ) : (
        selectEl
      )}
    </td>
  );
};

// ---------------------------------------------------------------------------
// Main Row Component
// ---------------------------------------------------------------------------

export const GroundTruthRow = ({
  dimensions,
  cells,
  valueCounts,
  onSetCell,
  onClearCell,
}: GroundTruthRowProps) => {
  return (
    <tr style={{ animation: "fadeInRow 200ms ease-out" }}>
      <style>{`@keyframes fadeInRow { from { opacity: 0; } to { opacity: 1; } }`}</style>
      {/* Left label cell — star + "Ground Truth" */}
      <td
        className="px-4 py-2.5 align-middle font-semibold text-label-small border-t-2 border-r border-neutral-border-bold sticky left-0 z-10"
        style={{
          backgroundColor: "var(--color-accent-canteloupe-subtle, #FFF8E1)",
          color: "var(--color-accent-canteloupe-bold, #7C5C00)",
          minWidth: 160,
        }}
      >
        <div className="flex items-center gap-tight">
          <IconStar width={24} height={24} style={{ color: "#FFC53D" }} />
          <span>Ground Truth</span>
        </div>
      </td>

      {/* Per-dimension cells */}
      {dimensions.map((dim) => {
        const cell = cells.get(dim.dimensionId);
        const dimOptions = valueCounts.get(dim.dimensionId) ?? [];

        return (
          <GroundTruthCellComponent
            key={dim.dimensionId}
            dimension={dim}
            cell={cell}
            options={dimOptions}
            onSetCell={(value, source) => onSetCell(dim.dimensionId, value, source)}
          />
        );
      })}
    </tr>
  );
};
