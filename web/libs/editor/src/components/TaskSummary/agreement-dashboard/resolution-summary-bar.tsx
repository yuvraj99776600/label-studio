/**
 * Resolution Summary Bar for Ground Truth Mode.
 *
 * Shows progress, bulk-action buttons, and the final "Create Ground Truth"
 * trigger. Only rendered when Ground Truth Mode is active.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cnm, Tooltip } from "@humansignal/ui";
import { IconChevronDown, IconStar } from "@humansignal/icons";
import type { MajorityCandidate, GroundTruthSummary } from "./use-ground-truth";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ResolutionSummaryBarProps {
  resolvedCount: number;
  totalCount: number;
  progress: number;
  unanimousCount: number;
  isComplete: boolean;
  summary: GroundTruthSummary;
  getMajorityCandidates: (threshold: number) => MajorityCandidate[];
  onAutoAcceptUnanimous: () => void;
  onAutoAcceptMajority: (threshold: number, selectedDimIds?: number[]) => void;
  onCreateGroundTruth: () => void;
}

// ---------------------------------------------------------------------------
// Threshold options
// ---------------------------------------------------------------------------

const THRESHOLD_OPTIONS = [
  { value: 0.6, label: "60%" },
  { value: 0.7, label: "70%" },
  { value: 0.8, label: "80%" },
  { value: 0.9, label: "90%" },
];

// ---------------------------------------------------------------------------
// Majority Confirmation Popover
// ---------------------------------------------------------------------------

interface MajorityPopoverProps {
  threshold: number;
  onThresholdChange: (t: number) => void;
  getCandidates: (t: number) => MajorityCandidate[];
  onConfirm: (selectedDimIds: number[]) => void;
  onClose: () => void;
}

const MajorityPopover = ({ threshold, onThresholdChange, getCandidates, onConfirm, onClose }: MajorityPopoverProps) => {
  const candidates = useMemo(() => getCandidates(threshold), [getCandidates, threshold]);
  const [selected, setSelected] = useState<Set<number>>(() => new Set(candidates.map((c) => c.dimensionId)));
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync selection when threshold changes
  useEffect(() => {
    setSelected(new Set(getCandidates(threshold).map((c) => c.dimensionId)));
  }, [threshold, getCandidates]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const toggleDim = useCallback((dimId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(dimId)) {
        next.delete(dimId);
      } else {
        next.add(dimId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelected(new Set(candidates.map((c) => c.dimensionId)));
  }, [candidates]);

  const handleSelectNone = useCallback(() => {
    setSelected(new Set());
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute right-0 top-full mt-tighter z-50 w-[28rem] rounded-small border border-neutral-border bg-neutral-surface shadow-lg"
      role="dialog"
      aria-label="Auto-accept majority"
    >
      {/* Header with threshold selector */}
      <div className="p-tight border-b border-neutral-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-tight">
            <span className="text-label-small font-semibold text-neutral-content">
              Auto-accept majority
            </span>
            <select
              value={threshold}
              onChange={(e) => onThresholdChange(Number(e.target.value))}
              className="px-tighter py-tighter rounded-small text-label-smallest border border-neutral-border bg-neutral-surface text-neutral-content cursor-pointer"
              aria-label="Majority threshold"
            >
              {THRESHOLD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  ≥ {opt.label}
                </option>
              ))}
            </select>
          </div>
          {candidates.length > 0 && (
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
          )}
        </div>
        {candidates.length > 0 ? (
          <p className="text-label-smallest text-neutral-content-subtler mt-tighter">
            {candidates.length} dimension{candidates.length !== 1 ? "s" : ""} where the majority meets the threshold.
            Uncheck any you want to review manually.
          </p>
        ) : (
          <p className="text-label-smallest text-neutral-content-subtle mt-tighter">
            No unresolved dimensions meet the ≥{Math.round(threshold * 100)}% majority threshold.
          </p>
        )}
      </div>

      {/* Candidate list */}
      {candidates.length > 0 && (
        <div className="overflow-y-auto p-tight" style={{ maxHeight: "min(40vh, 400px)" }}>
          {candidates.map((c) => (
            <label
              key={c.dimensionId}
              className="flex items-start gap-tight px-tight py-tighter rounded-small cursor-pointer hover:bg-neutral-surface-hover transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.has(c.dimensionId)}
                onChange={() => toggleDim(c.dimensionId)}
                className="mt-0.5 rounded border-neutral-border accent-primary-content"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-tight">
                  <span className="text-label-small font-medium text-neutral-content truncate">{c.name}</span>
                  <span className="text-label-smallest text-neutral-content-subtle">
                    {String(c.majorityValue)} ({c.majorityCount}/{c.total})
                  </span>
                </div>
                {c.deviatingAnnotators.length > 0 && (
                  <p className="text-label-smallest text-negative-content">
                    Deviated: {c.deviatingAnnotators.join(", ")}
                  </p>
                )}
              </div>
            </label>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between p-tight border-t border-neutral-border">
        <span className="text-label-smallest text-neutral-content-subtle">
          {candidates.length > 0 ? `${selected.size} of ${candidates.length} selected` : ""}
        </span>
        <div className="flex gap-tight">
          <button
            type="button"
            onClick={onClose}
            className="px-tight py-tighter rounded-small text-label-small border border-neutral-border bg-neutral-surface text-neutral-content hover:bg-neutral-surface-hover cursor-pointer"
          >
            Cancel
          </button>
          {candidates.length > 0 && (
            <button
              type="button"
              disabled={selected.size === 0}
              onClick={() => {
                onConfirm([...selected]);
                onClose();
              }}
              className={cnm(
                "px-tight py-tighter rounded-small text-label-small border cursor-pointer transition-colors",
                selected.size > 0
                  ? "bg-positive-background text-positive-content hover:opacity-90"
                  : "bg-neutral-surface border-neutral-border text-neutral-content-subtler cursor-not-allowed",
              )}
              style={selected.size > 0 ? { borderColor: "var(--color-positive-content)" } : undefined}
            >
              Accept {selected.size}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const ResolutionSummaryBar = ({
  resolvedCount,
  totalCount,
  progress,
  unanimousCount,
  isComplete,
  summary,
  getMajorityCandidates,
  onAutoAcceptUnanimous,
  onAutoAcceptMajority,
  onCreateGroundTruth,
}: ResolutionSummaryBarProps) => {
  const [threshold, setThreshold] = useState(0.8);
  const [showMajorityPopover, setShowMajorityPopover] = useState(false);

  // Count unresolved unanimous (those not yet auto-accepted)
  const unresolvedUnanimous = useMemo(() => {
    // unanimousCount is the total, summary.autoUnanimous is already resolved
    return Math.max(0, unanimousCount - summary.autoUnanimous);
  }, [unanimousCount, summary.autoUnanimous]);

  const remaining = totalCount - resolvedCount;

  const handleMajorityConfirm = useCallback(
    (selectedDimIds: number[]) => {
      onAutoAcceptMajority(threshold, selectedDimIds);
    },
    [onAutoAcceptMajority, threshold],
  );

  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDropdown]);

  const primaryDisabled = unresolvedUnanimous === 0;

  return (
    <div className="flex flex-wrap items-center gap-base p-base rounded-small border-2 border-dashed mt-tight"
      style={{
        borderColor: "var(--color-accent-canteloupe-base, #FFC53D)",
        backgroundColor: "var(--color-accent-canteloupe-subtle, #FFF8E1)",
      }}
    >
      {/* Star + label */}
      <div className="flex items-center gap-tight flex-shrink-0">
        <IconStar width={24} height={24} style={{ color: "#FFC53D" }} />
        <span className="text-label-small font-semibold text-neutral-content">Ground Truth Progress</span>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-tight flex-shrink-0">
        <div className="relative w-[120px] h-2 rounded-full overflow-hidden bg-neutral-surface border border-neutral-border">
          <div
            className="absolute inset-y-0 left-0 bg-positive-surface-hover transition-all duration-300 rounded-full"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <span className="text-label-smallest font-semibold text-neutral-content whitespace-nowrap">
          {resolvedCount} / {totalCount}
        </span>
      </div>

      {/* Split combo button: Auto-accept unanimous | chevron dropdown */}
      <div className="relative flex items-stretch" ref={dropdownRef}>
        <Tooltip title={primaryDisabled
          ? "No unresolved unanimous dimensions"
          : `Accept all ${unresolvedUnanimous} dimensions where every annotator agrees`}
        >
          <button
            type="button"
            disabled={primaryDisabled}
            onClick={onAutoAcceptUnanimous}
            className={cnm(
              "px-tight py-tighter border border-r-0 text-label-small transition-colors cursor-pointer",
              primaryDisabled
                ? "bg-neutral-surface border-neutral-border text-neutral-content-subtler cursor-not-allowed"
                : "bg-positive-background text-positive-content hover:opacity-90",
            )}
            style={{
              borderRadius: "var(--corner-radius-small) 0 0 var(--corner-radius-small)",
              ...(!primaryDisabled ? { borderColor: "var(--color-positive-content)" } : {}),
            }}
          >
            Auto-accept unanimous ({unresolvedUnanimous})
          </button>
        </Tooltip>
        <button
          type="button"
          onClick={() => setShowDropdown((prev) => !prev)}
          className={cnm(
            "px-tighter border border-l-0 transition-colors cursor-pointer flex items-center",
            primaryDisabled
              ? "bg-neutral-surface border-neutral-border text-neutral-content-subtler"
              : "bg-positive-background text-positive-content hover:opacity-90",
          )}
          style={{
            borderRadius: "0 var(--corner-radius-small) var(--corner-radius-small) 0",
            ...(!primaryDisabled ? { borderColor: "var(--color-positive-content)" } : {}),
          }}
          aria-label="More auto-accept options"
          aria-expanded={showDropdown}
        >
          <IconChevronDown width={14} height={14} />
        </button>

        {/* Dropdown menu */}
        {showDropdown && !showMajorityPopover && (
          <div className="absolute right-0 top-full mt-tighter z-50 min-w-[200px] rounded-small border border-neutral-border bg-neutral-surface shadow-lg py-tighter">
            <button
              type="button"
              onClick={() => {
                setShowDropdown(false);
                setShowMajorityPopover(true);
              }}
              className="w-full text-left px-tight py-tighter text-label-small text-neutral-content hover:bg-neutral-surface-hover transition-colors cursor-pointer"
            >
              Auto-accept majority…
            </button>
          </div>
        )}

        {/* Majority popover */}
        {showMajorityPopover && (
          <MajorityPopover
            threshold={threshold}
            onThresholdChange={setThreshold}
            getCandidates={getMajorityCandidates}
            onConfirm={handleMajorityConfirm}
            onClose={() => setShowMajorityPopover(false)}
          />
        )}
      </div>

      {/* Create button */}
      <Tooltip title={isComplete ? "Create the ground truth annotation" : `Resolve all ${remaining} remaining dimensions first`}>
        <button
          type="button"
          disabled={!isComplete}
          onClick={onCreateGroundTruth}
          className={cnm(
            "px-base py-tighter rounded-small text-label-small font-semibold border transition-colors cursor-pointer",
            isComplete
              ? "text-white border-transparent hover:opacity-90"
              : "bg-neutral-surface border-neutral-border text-neutral-content-subtler cursor-not-allowed",
          )}
          style={isComplete ? {
            backgroundColor: "var(--color-accent-canteloupe-bold, #7C5C00)",
            color: "#FFFFFF",
          } : undefined}
        >
          Create
        </button>
      </Tooltip>
    </div>
  );
};
