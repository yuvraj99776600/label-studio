/**
 * Commit Ground Truth confirmation dialog.
 *
 * Opens a modal showing a summary of the ground truth resolution
 * before the reviewer commits. Handles:
 * 1. Creating a new annotation with ground_truth=true
 * 2. Optionally auto-accepting/rejecting existing annotations
 *    based on whether they match the ground truth.
 */

import { useState } from "react";
import { confirm } from "@humansignal/ui/lib/modal";
import { Checkbox } from "@humansignal/ui";
import { IconStar, IconWarning } from "@humansignal/icons";
import type { AnnotatorInfo, DimensionInfo, GroundTruthCell } from "./types";
import type { GroundTruthSummary } from "./use-ground-truth";
import type { MSTAnnotation, RawResult } from "../../../stores/types";

// ---------------------------------------------------------------------------
// Payload type
// ---------------------------------------------------------------------------

export interface GroundTruthPayload {
  taskId: number | string;
  cells: GroundTruthCell[];
  summary: GroundTruthSummary;
  reviewer: { id: number; email: string; displayName: string } | null;
  method: string;
  /** The annotations currently loaded for this task */
  annotations: MSTAnnotation[];
  /** Dimension metadata (name = from_name, controlTag = tag type) */
  dimensions: DimensionInfo[];
  /** Annotator info aligned with dimension values indices */
  annotators: AnnotatorInfo[];
  /** Whether to auto-accept/reject annotations based on ground truth match */
  autoReview: boolean;
}

// ---------------------------------------------------------------------------
// Build ground truth result from a template annotation
// ---------------------------------------------------------------------------

/**
 * Build the annotation `result` array for the ground truth annotation.
 *
 * Strategy: deep-clone the first annotation's result, then for every
 * resolved ground truth cell, find result items where `from_name`
 * matches the dimension's name and replace the value.
 */
function buildGroundTruthResult(
  annotations: MSTAnnotation[],
  cells: GroundTruthCell[],
  dimensions: DimensionInfo[],
): RawResult[] {
  // Find the first submitted annotation to use as a template
  const templateAnnotation = annotations.find((a) => a.type === "annotation" && a.pk);
  if (!templateAnnotation) return [];

  // Get the raw result from the template
  const templateResult = templateAnnotation.versions?.result ?? (templateAnnotation as any).serialized ?? [];
  if (!Array.isArray(templateResult) || templateResult.length === 0) return [];

  // Deep clone to avoid mutating the original
  const result: RawResult[] = JSON.parse(JSON.stringify(templateResult));

  // Build lookup: dimensionId -> DimensionInfo
  const dimMap = new Map<number, DimensionInfo>();
  for (const dim of dimensions) {
    dimMap.set(dim.dimensionId, dim);
  }

  // For each ground truth cell, find matching result items and replace values
  for (const cell of cells) {
    const dim = dimMap.get(cell.dimensionId);
    if (!dim || !dim.isCategorical) continue;

    const fromName = dim.name;
    const tagType = dim.controlTag.toLowerCase();

    for (const item of result) {
      if (item.from_name !== fromName) continue;

      // Replace value based on the control tag type
      if (tagType === "choices" || tagType === "choice") {
        item.value = { ...item.value, choices: [String(cell.value)] };
      } else if (tagType === "taxonomy") {
        item.value = { ...item.value, taxonomy: [[String(cell.value)]] };
      } else if (tagType === "rating") {
        item.value = { ...item.value, rating: Number(cell.value) };
      } else if (tagType === "number") {
        item.value = { ...item.value, number: Number(cell.value) };
      } else {
        // Generic fallback: set the tag-type key to the value
        item.value = { ...item.value, [tagType]: cell.value };
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Check if an annotation matches ground truth
// ---------------------------------------------------------------------------

/**
 * Compare an annotation's dimension values against the ground truth.
 * Uses the pre-computed per-annotator values from DimensionInfo.values[]
 * (indexed by annotator order from the agreement API).
 *
 * Returns true if ALL resolved dimensions match, false otherwise.
 */
function doesAnnotationMatchGroundTruth(
  annotatorIndex: number,
  cells: GroundTruthCell[],
  dimensions: DimensionInfo[],
): boolean {
  const dimMap = new Map<number, DimensionInfo>();
  for (const dim of dimensions) {
    dimMap.set(dim.dimensionId, dim);
  }

  for (const cell of cells) {
    const dim = dimMap.get(cell.dimensionId);
    if (!dim || !dim.isCategorical || !dim.values) continue;

    const annotatorValue = dim.values[annotatorIndex];

    // Compare as strings for consistency (dimension values may be mixed types)
    if (String(annotatorValue) !== String(cell.value)) {
      return false;
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Dialog body component
// ---------------------------------------------------------------------------

interface DialogBodyProps {
  summary: GroundTruthSummary;
  reviewerName: string;
  annotationCount: number;
  acceptCount: number;
  rejectCount: number;
  onAutoReviewChange: (checked: boolean) => void;
}

const DialogBody = ({ summary, reviewerName, annotationCount, acceptCount, rejectCount, onAutoReviewChange }: DialogBodyProps) => {
  // Internal state so the checkbox re-renders within the static confirm() body
  const [checked, setChecked] = useState(false);

  return (
    <div className="space-y-base">
      {/* Resolution summary */}
      <div className="rounded-small border border-neutral-border p-base bg-neutral-surface-subtle">
        <div className="text-label-small font-semibold text-neutral-content mb-tight">
          {summary.total} dimensions resolved:
        </div>
        <ul className="space-y-tighter text-label-small text-neutral-content">
          {summary.autoUnanimous > 0 && (
            <li className="flex items-center gap-tight">
              <span className="w-2 h-2 rounded-full bg-positive-content inline-block flex-shrink-0" />
              {summary.autoUnanimous} auto-accepted (unanimous)
            </li>
          )}
          {summary.autoMajority > 0 && (
            <li className="flex items-center gap-tight">
              <span className="w-2 h-2 rounded-full bg-warning-content inline-block flex-shrink-0" />
              {summary.autoMajority} auto-accepted (majority)
            </li>
          )}
          {summary.manual > 0 && (
            <li className="flex items-center gap-tight">
              <span className="w-2 h-2 rounded-full bg-primary-content inline-block flex-shrink-0" />
              {summary.manual} manually adjudicated
            </li>
          )}
        </ul>
      </div>

      {/* Auto accept/reject option */}
      <div className="flex items-start gap-tight cursor-pointer rounded-small border border-neutral-border p-base hover:bg-neutral-surface-hover transition-colors">
        <div className="flex-shrink-0 pt-0.5">
          <Checkbox
            checked={checked}
            onChange={(e) => {
              const next = e.target.checked;
              setChecked(next);
              onAutoReviewChange(next);
            }}
          />
        </div>
        <div
          className="cursor-pointer select-none"
          onClick={() => {
            const next = !checked;
            setChecked(next);
            onAutoReviewChange(next);
          }}
        >
          <div className="text-label-small font-semibold text-neutral-content">
            Auto accept/reject annotations
          </div>
          <div className="text-label-smallest text-neutral-content-subtle">
            Automatically accept annotations that match the ground truth and reject those that don't.
            This will create a review for each of the {annotationCount} annotation{annotationCount !== 1 ? "s" : ""}.
          </div>
        </div>
      </div>

      {/* Meta info */}
      <div className="text-label-small text-neutral-content-subtle space-y-tighter">
        <p className="flex items-center gap-tight">
          <IconWarning width={16} height={16} className="text-warning-content flex-shrink-0" />
          A new annotation will be created and marked as ground truth.
        </p>
        <div className="flex items-center gap-tight">
          <span className="font-semibold text-neutral-content">Annotator:</span>
          <span>{reviewerName}</span>
        </div>
        <div className="flex items-center gap-tight">
          <span className="font-semibold text-neutral-content">Method:</span>
          <span>Consensus-based with manual review</span>
        </div>
        {checked && (
          <p className="flex items-center gap-tight">
            <IconWarning width={16} height={16} className="text-warning-content flex-shrink-0" />
            {acceptCount} annotation{acceptCount !== 1 ? "s" : ""} will be accepted, {rejectCount} annotation{rejectCount !== 1 ? "s" : ""} rejected
          </p>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Open the confirmation dialog
// ---------------------------------------------------------------------------

interface OpenCommitDialogOptions {
  taskId: number | string;
  cells: Map<number, GroundTruthCell>;
  summary: GroundTruthSummary;
  annotations: MSTAnnotation[];
  dimensions: DimensionInfo[];
  annotators: AnnotatorInfo[];
  onCommit: (payload: GroundTruthPayload) => void;
}

export function openCommitGroundTruthDialog({
  taskId,
  cells,
  summary,
  annotations,
  dimensions,
  annotators,
  onCommit,
}: OpenCommitDialogOptions): void {
  const currentUser = window.APP_SETTINGS?.user;
  const reviewer = currentUser
    ? {
        id: currentUser.id,
        email: currentUser.email ?? "",
        displayName:
          [currentUser.first_name, currentUser.last_name].filter(Boolean).join(" ") ||
          currentUser.email ||
          `User ${currentUser.id}`,
      }
    : null;

  const reviewerName = reviewer?.displayName ?? "Unknown";

  // Count submitted annotations (not predictions)
  const submittedAnnotations = annotations.filter((a) => a.type === "annotation" && a.pk);
  const annotationCount = submittedAnnotations.length;

  // Pre-compute accept/reject counts for the dialog preview
  const cellsArray = [...cells.values()];
  const annotatorIndexMap = new Map<number, number>();
  for (const annotator of annotators) {
    annotatorIndexMap.set(annotator.id, annotator.index);
  }
  let acceptCount = 0;
  let rejectCount = 0;
  for (const ann of submittedAnnotations) {
    const userId = ann.user?.id;
    if (userId === undefined) continue;
    const idx = annotatorIndexMap.get(Number(userId));
    if (idx === undefined) continue;
    if (doesAnnotationMatchGroundTruth(idx, cellsArray, dimensions)) {
      acceptCount++;
    } else {
      rejectCount++;
    }
  }

  // Mutable state for the auto-review checkbox (captured by ref in the dialog)
  let autoReview = false;

  const buildPayload = (): GroundTruthPayload => ({
    taskId,
    cells: [...cells.values()],
    summary,
    reviewer,
    method: "consensus_with_manual_review",
    annotations,
    dimensions,
    annotators,
    autoReview,
  });

  confirm({
    title: (
      <span className="flex items-center gap-tight">
        <IconStar width={24} height={24} style={{ color: "#FFC53D" }} />
        Create Ground Truth
      </span>
    ) as unknown as string,
    body: (
      <DialogBody
        summary={summary}
        reviewerName={reviewerName}
        annotationCount={annotationCount}
        acceptCount={acceptCount}
        rejectCount={rejectCount}
        onAutoReviewChange={(value) => {
          autoReview = value;
        }}
      />
    ),
    okText: "Create Ground Truth",
    cancelText: "Cancel",
    onOk: () => {
      onCommit(buildPayload());
    },
  });
}

// ---------------------------------------------------------------------------
// Commit ground truth (real API calls)
// ---------------------------------------------------------------------------

/**
 * Create a ground truth annotation and optionally auto-review
 * existing annotations.
 *
 * Step 1: POST /api/tasks/{taskId}/annotations/ with ground_truth=true
 * Step 2: If autoReview, POST /api/annotation-reviews/ for each annotation
 */
export async function commitGroundTruth(
  payload: GroundTruthPayload,
  onSuccess: (newAnnotationId: number) => void,
): Promise<void> {
  const { taskId, cells, annotations, dimensions, annotators, autoReview } = payload;

  // -------------------------------------------------------------------------
  // Step 1: Build and submit the ground truth annotation
  // -------------------------------------------------------------------------

  const groundTruthResult = buildGroundTruthResult(annotations, cells, dimensions);

  if (groundTruthResult.length === 0) {
    console.error("[Ground Truth] Failed to build result: no template annotation found or empty result.");
    throw new Error("Could not build ground truth annotation. No template annotation available.");
  }

  const annotationBody = {
    result: groundTruthResult,
    ground_truth: true,
    lead_time: 0,
    started_at: new Date().toISOString(),
  };

  const annotationResponse = await fetch(`/api/tasks/${taskId}/annotations/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(annotationBody),
  });

  if (!annotationResponse.ok) {
    const errorText = await annotationResponse.text().catch(() => "Unknown error");
    console.error("[Ground Truth] Failed to create annotation:", annotationResponse.status, errorText);
    throw new Error(`Failed to create ground truth annotation (${annotationResponse.status}).`);
  }

  const newAnnotation = await annotationResponse.json();
  console.info("[Ground Truth] Created ground truth annotation:", newAnnotation.id);

  // -------------------------------------------------------------------------
  // Step 2: Auto accept/reject existing annotations (if enabled)
  // -------------------------------------------------------------------------

  if (autoReview) {
    // Build a map of annotator user ID -> annotator index
    const annotatorIndexMap = new Map<number, number>();
    for (const annotator of annotators) {
      annotatorIndexMap.set(annotator.id, annotator.index);
    }

    const submittedAnnotations = annotations.filter((a) => a.type === "annotation" && a.pk);

    const reviewPromises = submittedAnnotations.map(async (ann) => {
      const userId = ann.user?.id;
      if (userId === undefined) return;

      const annotatorIndex = annotatorIndexMap.get(Number(userId));
      if (annotatorIndex === undefined) return;

      const matches = doesAnnotationMatchGroundTruth(annotatorIndex, cells, dimensions);

      const reviewBody = {
        annotation: Number(ann.pk),
        accepted: matches,
      };

      try {
        const reviewResponse = await fetch("/api/annotation-reviews/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(reviewBody),
        });

        if (!reviewResponse.ok) {
          const errorText = await reviewResponse.text().catch(() => "Unknown error");
          console.warn(
            `[Ground Truth] Failed to create review for annotation ${ann.pk}:`,
            reviewResponse.status,
            errorText,
          );
        } else {
          console.info(
            `[Ground Truth] Review for annotation ${ann.pk}: ${matches ? "accepted" : "rejected"}`,
          );
        }
      } catch (err) {
        console.warn(`[Ground Truth] Error creating review for annotation ${ann.pk}:`, err);
      }
    });

    await Promise.all(reviewPromises);
  }

  // -------------------------------------------------------------------------
  // Success — pass back the new annotation ID for navigation
  // -------------------------------------------------------------------------

  onSuccess(newAnnotation.id);
}
