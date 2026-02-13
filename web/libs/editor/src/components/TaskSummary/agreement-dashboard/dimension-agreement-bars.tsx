/**
 * Per-Dimension Agreement Bar Plot (§7)
 *
 * Horizontal bar chart ranking all dimensions by agreement score
 * (most problematic first). Shows a category chip per dimension
 * and a reference line at the overall agreement score.
 */

import { cnm, Tooltip } from "@humansignal/ui";
import { Chip } from "../Chip";
import { getAgreementBgColor, getAgreementTextColor } from "./agreement-utils";
import type { DimensionScore } from "./types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DimensionAgreementBarsProps {
  dimensionScores: DimensionScore[];
  overallAgreement: number | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const DimensionAgreementBars = ({
  dimensionScores,
  overallAgreement,
}: DimensionAgreementBarsProps) => {
  if (dimensionScores.length === 0) {
    return (
      <div className="text-neutral-content-subtle text-label-small italic p-base">
        No dimension scores available.
      </div>
    );
  }

  return (
    <div
      className="space-y-tight"
      aria-label={`Per-dimension agreement scores for ${dimensionScores.length} dimensions`}
    >
      {dimensionScores.map((dim) => (
        <div key={dim.dimensionId} className="flex items-center gap-tight">
          {/* Dimension name + chip */}
          <div className="w-36 shrink-0 flex flex-col gap-tighter text-right">
            <span className="text-label-small font-medium text-neutral-content truncate">
              {dim.name}
            </span>
            <Chip className="px-small self-end">{dim.controlTag}</Chip>
          </div>

          {/* Bar container */}
          <div className="flex-1 relative h-6 bg-neutral-surface-subtle rounded-smallest overflow-visible">
            {/* Reference line at overall agreement */}
            {overallAgreement !== null && (
              <Tooltip title={`Overall agreement: ${(overallAgreement * 100).toFixed(1)}%`}>
                <div
                  className="absolute top-0 bottom-0 w-px bg-neutral-border-bold z-10"
                  style={{ left: `${overallAgreement * 100}%` }}
                />
              </Tooltip>
            )}

            {/* Score bar */}
            <Tooltip
              title={`${dim.name}: ${(dim.score * 100).toFixed(1)}% agreement (${dim.metricType})`}
            >
              <div
                className={cnm("h-full rounded-smallest transition-all", getAgreementBgColor(dim.score))}
                style={{ width: `${Math.max(dim.score * 100, 2)}%` }}
                role="img"
                aria-label={`${dim.name}: ${(dim.score * 100).toFixed(1)}% agreement`}
              />
            </Tooltip>
          </div>

          {/* Score value */}
          <span
            className={cnm(
              "w-12 text-right text-label-small font-semibold shrink-0",
              getAgreementTextColor(dim.score),
            )}
          >
            {(dim.score * 100).toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  );
};
