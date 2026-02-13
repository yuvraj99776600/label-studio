/**
 * Distribution Plot, Majority Vote & Deviation Viewer (§5)
 *
 * For a selected categorical dimension, shows:
 * - Distribution bar chart of label frequencies
 * - Majority vote badge
 * - Deviation list showing which annotators agree/deviate
 */

import { useState, useMemo } from "react";
import { cnm, Tooltip } from "@humansignal/ui";
import { IconCheck, IconCross } from "@humansignal/icons";

// These SVG icons use width/height props (not size)
import { computeMajorityVote, isConflict } from "./agreement-utils";
import type { AnnotatorInfo, DimensionInfo } from "./types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DistributionViewerProps {
  categoricalDimensions: DimensionInfo[];
  annotators: AnnotatorInfo[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const DistributionViewer = ({
  categoricalDimensions,
  annotators,
}: DistributionViewerProps) => {
  const [selectedDimId, setSelectedDimId] = useState<number | null>(
    categoricalDimensions[0]?.dimensionId ?? null,
  );

  const selectedDim = useMemo(
    () => categoricalDimensions.find((d) => d.dimensionId === selectedDimId) ?? null,
    [categoricalDimensions, selectedDimId],
  );

  const majorityVote = useMemo(
    () => (selectedDim?.values ? computeMajorityVote(selectedDim.values) : null),
    [selectedDim],
  );

  // Build distribution: label -> count
  const distribution = useMemo(() => {
    if (!selectedDim?.values) return [];

    const counts = new Map<string, number>();
    for (const v of selectedDim.values) {
      if (v === null || v === undefined) continue;
      const key = String(v);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [selectedDim]);

  const maxCount = useMemo(
    () => Math.max(1, ...distribution.map((d) => d.count)),
    [distribution],
  );

  if (categoricalDimensions.length === 0) {
    return (
      <div className="text-neutral-content-subtle text-label-small italic p-base">
        No categorical dimensions available.
      </div>
    );
  }

  return (
    <div>
      {/* Dimension selector */}
      <div className="mb-base">
        <select
          value={selectedDimId ?? ""}
          onChange={(e) => setSelectedDimId(Number(e.target.value))}
          className="w-full rounded-small border border-neutral-border bg-neutral-surface px-tight py-tight text-label-small text-neutral-content cursor-pointer"
          aria-label="Select dimension for distribution view"
        >
          {categoricalDimensions.map((dim) => (
            <option key={dim.dimensionId} value={dim.dimensionId}>
              {dim.name} ({dim.controlTag})
            </option>
          ))}
        </select>
      </div>

      {selectedDim && majorityVote && (
        <>
          {/* Majority vote badge */}
          <div className="mb-base">
            {majorityVote.isTie ? (
              <div className="inline-flex items-center gap-tight px-base py-tight rounded-small bg-warning-background border border-warning-border">
                <span className="text-warning-content font-bold text-label-small">Tie</span>
                <span className="text-label-small text-neutral-content">
                  {majorityVote.tiedValues.map(String).join(", ")} ({majorityVote.count}/
                  {majorityVote.total} each)
                </span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-tight px-base py-tight rounded-small bg-positive-background border border-positive-border-subtle">
                <span className="text-label-small font-semibold text-positive-content">
                  Majority: {String(majorityVote.value)}
                </span>
                <span className="text-label-small text-neutral-content-subtle">
                  ({majorityVote.count}/{majorityVote.total} annotators)
                </span>
              </div>
            )}
          </div>

          {/* Distribution bar chart */}
          <div className="mb-base space-y-tight">
            {distribution.map(({ label, count }) => (
              <div key={label} className="flex items-center gap-tight">
                <span className="w-24 text-label-small text-neutral-content truncate text-right shrink-0">
                  {label}
                </span>
                <div className="flex-1 h-6 bg-neutral-surface-subtle rounded-smallest overflow-hidden">
                  <Tooltip title={`${label}: ${count} annotator${count !== 1 ? "s" : ""}`}>
                    <div
                      className="h-full bg-primary-surface rounded-smallest transition-all"
                      style={{ width: `${(count / maxCount) * 100}%` }}
                      role="img"
                      aria-label={`${label}: ${count} of ${majorityVote.total} annotators`}
                    />
                  </Tooltip>
                </div>
                <span className="text-label-small font-medium text-neutral-content w-8 text-right shrink-0">
                  {count}
                </span>
              </div>
            ))}
          </div>

          {/* Deviation list */}
          <div className="space-y-tighter">
            <h4 className="text-label-small font-semibold text-neutral-content-subtle mb-tight">
              Per-annotator breakdown
            </h4>
            {annotators.map((annotator) => {
              const value = selectedDim.values?.[annotator.index] ?? null;
              const deviates = isConflict(value, majorityVote);
              const displayValue = value !== null ? String(value) : "N/A";

              return (
                <div
                  key={annotator.id}
                  className={cnm(
                    "flex items-center gap-tight py-tighter px-tight rounded-smallest text-label-small",
                    deviates ? "text-negative-content" : "text-positive-content",
                  )}
                >
                  <span className="shrink-0 w-4 h-4 flex items-center justify-center">
                    {deviates ? (
                      <IconCross width={12} height={12} />
                    ) : (
                      <IconCheck width={12} height={12} />
                    )}
                  </span>
                  <span className="font-medium">{annotator.displayName}</span>
                  <span className="text-neutral-content-subtle">—</span>
                  <span className={cnm(deviates ? "font-bold" : "")}>
                    {displayValue}
                  </span>
                  {deviates && (
                    <span className="text-negative-content font-bold uppercase text-[10px]">
                      deviates
                    </span>
                  )}
                  {!deviates && value !== null && (
                    <span className="text-positive-content-subtle text-[10px]">agrees</span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
