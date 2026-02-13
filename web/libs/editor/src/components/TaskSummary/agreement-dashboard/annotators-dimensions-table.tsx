/**
 * Annotators × Dimensions Table (§3)
 *
 * Primary comparison view showing what each annotator chose for every
 * dimension, highlights disagreements, and includes a pinned Majority Vote
 * summary row. Supports both categorical and non-categorical dimensions
 * (non-categorical dimensions display "—" for values and N/A for majority vote).
 *
 * V1: Read-only — no click, sort, or drag interactions.
 */

import { useMemo } from "react";
import { cnm, Tooltip, Userpic } from "@humansignal/ui";
import { computeMajorityVote, isConflict } from "./agreement-utils";
import { GroundTruthRow } from "./ground-truth-row";
import type { AnnotatorInfo, DimensionInfo, DimensionScore, GroundTruthCell, GroundTruthSource, MajorityVoteResult } from "./types";
import type { ValueCount } from "./use-ground-truth";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AnnotatorsDimensionsTableProps {
  dimensions: DimensionInfo[];
  annotators: AnnotatorInfo[];
  /** Optional per-dimension scores to render as agreement bars under the table */
  dimensionScores?: DimensionScore[];
  /** Ground Truth Mode props (all optional — table works without them) */
  groundTruthActive?: boolean;
  groundTruthCells?: Map<number, GroundTruthCell>;
  groundTruthValueCounts?: Map<number, ValueCount[]>;
  onSetGroundTruthCell?: (dimensionId: number, value: string | number | boolean | null, source?: GroundTruthSource) => void;
  onClearGroundTruthCell?: (dimensionId: number) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const AnnotatorsDimensionsTable = ({
  dimensions,
  annotators,
  dimensionScores,
  groundTruthActive,
  groundTruthCells,
  groundTruthValueCounts,
  onSetGroundTruthCell,
  onClearGroundTruthCell,
}: AnnotatorsDimensionsTableProps) => {
  // Build a lookup from dimensionId -> score for the footer bars
  const scoreMap = useMemo(() => {
    if (!dimensionScores) return null;
    const map = new Map<number, number>();
    for (const ds of dimensionScores) {
      map.set(ds.dimensionId, ds.score);
    }
    return map;
  }, [dimensionScores]);
  // Pre-compute majority vote for each dimension
  const majorityVotes = useMemo<Map<number, MajorityVoteResult>>(() => {
    const map = new Map<number, MajorityVoteResult>();
    for (const dim of dimensions) {
      if (dim.values) {
        map.set(dim.dimensionId, computeMajorityVote(dim.values));
      }
    }
    return map;
  }, [dimensions]);

  if (dimensions.length === 0 || annotators.length === 0) {
    return (
      <div className="text-neutral-content-subtle text-label-small italic p-base">
        No dimensions available for comparison.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table
        className="border border-neutral-border rounded-small w-full"
        style={{ borderCollapse: "separate", borderSpacing: 0 }}
        aria-label={`Annotators × Dimensions comparison table with ${annotators.length} annotators and ${dimensions.length} dimensions`}
      >
        {/* Header */}
        <thead className="sticky top-0 z-10">
          <tr>
            {/* Annotator column header */}
            <th
              className="px-4 py-2.5 text-left whitespace-nowrap font-semibold text-label-small bg-neutral-surface border-b border-r border-neutral-border sticky left-0 z-20"
              style={{ minWidth: 160 }}
            >
              Annotator
            </th>
            {/* Dimension column headers */}
            {dimensions.map((dim) => (
              <th
                key={dim.dimensionId}
                className="px-4 py-2.5 text-left whitespace-nowrap font-semibold text-label-small bg-neutral-surface border-b border-neutral-border"
                style={{ minWidth: 120 }}
              >
                <div className="flex items-center gap-tight">
                  <span>{dim.name}</span>
                  {dim.controlTag && (
                    <span className="bg-primary-background text-primary-content rounded px-tight h-5 flex items-center justify-center border border-primary-border-subtler text-label-smallest font-normal">
                      {dim.controlTag}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {/* Annotator rows */}
          {annotators.map((annotator, rowIndex) => {
            const isEvenRow = rowIndex % 2 === 0;

            return (
              <tr key={annotator.id} className="group">
                {/* Annotator name cell */}
                <td
                  className={cnm(
                    "px-4 py-2.5 align-middle border-r border-neutral-border sticky left-0 z-10",
                    isEvenRow ? "bg-neutral-surface" : "bg-neutral-background",
                    "group-hover:bg-neutral-surface-hover",
                    rowIndex < annotators.length - 1 && "border-b border-neutral-border-subtle",
                  )}
                  style={{ minWidth: 160 }}
                >
                  <div className="flex gap-tight items-center">
                    <Userpic user={annotator.user} />
                    <span className="text-label-small font-medium">{annotator.displayName}</span>
                  </div>
                </td>

                {/* Value cells */}
                {dimensions.map((dim) => {
                  // Non-categorical dimensions have no displayable per-annotator values
                  if (!dim.isCategorical) {
                    return (
                      <td
                        key={dim.dimensionId}
                        className={cnm(
                          "px-4 py-2.5 align-middle text-label-small text-neutral-content-subtler italic transition-colors",
                          isEvenRow ? "bg-neutral-surface" : "bg-neutral-background",
                          "group-hover:bg-neutral-surface-hover",
                          rowIndex < annotators.length - 1 && "border-b border-neutral-border-subtle",
                        )}
                      >
                        N/A
                      </td>
                    );
                  }

                  const value = dim.values?.[annotator.index] ?? null;
                  const majority = majorityVotes.get(dim.dimensionId);
                  const conflict = majority ? isConflict(value, majority) : false;
                  const displayValue = value !== null ? String(value) : "—";

                  return (
                    <td
                      key={dim.dimensionId}
                      className={cnm(
                        "px-4 py-2.5 align-middle text-label-small transition-colors",
                        isEvenRow ? "bg-neutral-surface" : "bg-neutral-background",
                        "group-hover:bg-neutral-surface-hover",
                        rowIndex < annotators.length - 1 && "border-b border-neutral-border-subtle",
                        conflict
                          ? "bg-negative-background text-negative-content border-negative-border-subtle"
                          : value !== null
                            ? "bg-positive-background text-positive-content"
                            : "",
                      )}
                    >
                      {conflict && majority ? (
                        <Tooltip
                          title={`Majority: ${String(majority.value)} (${majority.count}/${majority.total}). This annotator chose: ${displayValue}`}
                        >
                          <span className="cursor-default">{displayValue}</span>
                        </Tooltip>
                      ) : (
                        <span>{displayValue}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}

          {/* Per-dimension agreement bars */}
          {scoreMap && (
            <tr>
              <td
                className="px-4 py-2 align-middle text-label-small font-semibold text-neutral-content bg-neutral-background border-t-2 border-r border-neutral-border-bold sticky left-0 z-10"
                style={{ minWidth: 160 }}
              >
                Agreement
              </td>
              {dimensions.map((dim) => {
                const score = scoreMap.get(dim.dimensionId);
                if (score === undefined) {
                  return (
                    <td
                      key={dim.dimensionId}
                      className="px-4 py-2 align-middle text-label-small bg-neutral-background border-t-2 border-neutral-border-bold text-neutral-content-subtler italic"
                    >
                      —
                    </td>
                  );
                }
                const pct = (score * 100).toFixed(0);
                return (
                  <td
                    key={dim.dimensionId}
                    className="px-4 py-2 align-middle bg-neutral-background border-t-2 border-neutral-border-bold"
                  >
                    <Tooltip title={`${dim.name}: ${(score * 100).toFixed(1)}% agreement`}>
                      <div className="relative w-full h-5 rounded-smallest overflow-hidden bg-negative-background">
                        {/* Green fill for agreement portion */}
                        <div
                          className="absolute inset-y-0 left-0 bg-positive-background transition-all"
                          style={{ width: `${score * 100}%` }}
                        />
                        {/* Percentage label centered inside the bar */}
                        <span className="absolute inset-0 flex items-center justify-center text-label-smallest font-semibold text-neutral-content">
                          {pct}%
                        </span>
                      </div>
                    </Tooltip>
                  </td>
                );
              })}
            </tr>
          )}

          {/* Majority Vote row */}
          <tr>
            <td
              className="px-4 py-2.5 align-middle font-semibold text-label-small bg-neutral-surface border-t border-r border-neutral-border sticky left-0 z-10"
              style={{ minWidth: 160 }}
            >
              <Tooltip title="Most common answer across all annotators, including conflicts and empty responses">
                <span className="cursor-default">Majority Vote</span>
              </Tooltip>
            </td>
            {dimensions.map((dim) => {
              // Non-categorical dimensions don't have majority vote
              if (!dim.isCategorical) {
                return (
                  <td
                    key={dim.dimensionId}
                    className="px-4 py-2.5 align-middle text-label-small bg-neutral-surface border-t border-neutral-border text-neutral-content-subtler italic"
                  >
                    N/A
                  </td>
                );
              }

              const majority = majorityVotes.get(dim.dimensionId);
              if (!majority || majority.value === null) {
                return (
                  <td
                    key={dim.dimensionId}
                    className="px-4 py-2.5 align-middle text-label-small bg-neutral-surface border-t border-neutral-border text-neutral-content-subtler"
                  >
                    —
                  </td>
                );
              }

              return (
                <td
                  key={dim.dimensionId}
                  className="px-4 py-2.5 align-middle text-label-small font-semibold bg-neutral-surface border-t border-neutral-border"
                >
                  <div className="flex items-center gap-tight">
                    <span>{String(majority.value)}</span>
                    <span className="text-neutral-content-subtle font-normal">
                      ({majority.count}/{majority.total})
                    </span>
                    {majority.isTie && (
                      <span className="text-warning-content text-label-small font-bold">Tie</span>
                    )}
                  </div>
                </td>
              );
            })}
          </tr>

          {/* Ground Truth row (only in Ground Truth Mode) */}
          {groundTruthActive && groundTruthCells && groundTruthValueCounts && onSetGroundTruthCell && onClearGroundTruthCell && (
            <GroundTruthRow
              dimensions={dimensions}
              cells={groundTruthCells}
              valueCounts={groundTruthValueCounts}
              onSetCell={onSetGroundTruthCell}
              onClearCell={onClearGroundTruthCell}
            />
          )}
        </tbody>
      </table>
    </div>
  );
};
