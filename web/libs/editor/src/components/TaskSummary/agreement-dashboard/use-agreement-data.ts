/**
 * React Query hook for fetching and deriving agreement dashboard data.
 *
 * Fetches from GET /api/tasks/{taskId}/agreement/ and transforms the
 * response into structures ready for each dashboard panel.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { userDisplayName } from "@humansignal/core";
import type { MSTAnnotation } from "../../../stores/types";
import {
  buildDimensionInfoList,
  buildDimensionScores,
  computeHeatmapMatrix,
  computeRowAverages,
  computeGrandAverage,
  countConflicts,
  isPerfectAgreement,
} from "./agreement-utils";
import type {
  AgreementMethod,
  AnnotatorInfo,
  ConflictFilter,
  DimensionInfo,
  DimensionScore,
  TaskAgreementResponse,
  TaskAgreementResult,
} from "./types";

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

const fetchAgreement = async (taskId: number | string): Promise<TaskAgreementResponse> => {
  const response = await fetch(`/api/tasks/${taskId}/agreement/`);
  if (!response.ok) {
    throw new Error(`Failed to fetch agreement data: ${response.status}`);
  }
  return response.json();
};

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

function isTaskAgreementResult(
  value: TaskAgreementResult | Record<string, never>,
): value is TaskAgreementResult {
  return "dimension_results" in value && "aggregation" in value && "annotator_ids" in value;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseAgreementDataOptions {
  taskId: number | string | undefined;
  method: AgreementMethod;
  conflictFilter: ConflictFilter;
  conflictsOnly: boolean;
  visibleColumnIds: number[] | null;
  annotations: MSTAnnotation[];
  hideInfo: boolean;
}

export interface AgreementData {
  /** Raw API response */
  raw: TaskAgreementResponse | undefined;
  /** Parsed agreement result (null when not available) */
  agreementResult: TaskAgreementResult | null;
  /** Enriched dimension info list */
  dimensions: DimensionInfo[];
  /** Only categorical dimensions */
  categoricalDimensions: DimensionInfo[];
  /** Filtered dimensions based on conflict filter + column visibility */
  filteredDimensions: DimensionInfo[];
  /** Annotator info resolved from annotations prop */
  annotators: AnnotatorInfo[];
  /** N×N heatmap matrix aggregated across all dimensions */
  heatmapMatrix: number[][];
  /** Row marginal averages for the heatmap */
  heatmapRowAverages: number[];
  /** Grand average for the heatmap */
  heatmapGrandAverage: number;
  /** Per-dimension scores for the bar chart, sorted ascending */
  dimensionScores: DimensionScore[];
  /** Overall agreement score for the selected method */
  overallAgreement: number | null;
  /** Number of dimensions with imperfect agreement */
  conflictCount: number;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Whether the agreement data has meaningful content */
  hasAgreementData: boolean;
}

export function useAgreementData({
  taskId,
  method,
  conflictFilter,
  conflictsOnly,
  visibleColumnIds,
  annotations,
  hideInfo,
}: UseAgreementDataOptions): AgreementData {
  const currentUser = window.APP_SETTINGS?.user;

  const {
    data: raw,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["task-agreement-dashboard", taskId],
    queryFn: () => fetchAgreement(taskId!),
    enabled: !!taskId,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  });

  const agreementResult = useMemo<TaskAgreementResult | null>(() => {
    if (!raw?.agreement || !isTaskAgreementResult(raw.agreement)) return null;
    return raw.agreement;
  }, [raw]);

  // Resolve annotator IDs to display info from the annotations prop
  const annotators = useMemo<AnnotatorInfo[]>(() => {
    if (!agreementResult) return [];

    const annotationMap = new Map<number, MSTAnnotation>();
    for (const ann of annotations) {
      if (ann.pk && ann.user?.id) {
        annotationMap.set(ann.user.id, ann);
      }
    }

    return agreementResult.annotator_ids.map((id, index) => {
      const ann = annotationMap.get(id);
      const user = ann?.user;
      let displayName: string;

      if (hideInfo) {
        displayName = currentUser?.id === id ? "Me" : `User ${index + 1}`;
      } else if (user) {
        displayName = userDisplayName(user as Record<string, string>);
      } else {
        displayName = `Annotator ${id}`;
      }

      return {
        id,
        index,
        displayName,
        user: user ? (user as Record<string, unknown>) : null,
      };
    });
  }, [agreementResult, annotations, hideInfo, currentUser]);

  // Build dimension info
  const dimensions = useMemo<DimensionInfo[]>(() => {
    if (!agreementResult) return [];
    return buildDimensionInfoList(agreementResult);
  }, [agreementResult]);

  const categoricalDimensions = useMemo(
    () => dimensions.filter((d) => d.isCategorical),
    [dimensions],
  );

  // Apply column selection mode + hide-unanimous filter
  const filteredDimensions = useMemo(() => {
    // 1. Select base set based on column selection mode
    let filtered: DimensionInfo[];
    if (conflictFilter === "custom") {
      // Custom: start from all dimensions, then apply visibility
      filtered = visibleColumnIds !== null
        ? dimensions.filter((d) => visibleColumnIds.includes(d.dimensionId))
        : dimensions;
    } else if (conflictFilter === "all_dimensions") {
      filtered = dimensions;
    } else {
      // "all" = categorical only
      filtered = categoricalDimensions;
    }

    // 2. Hide unanimous dimensions (independent of selection mode)
    if (conflictsOnly && agreementResult) {
      const scores =
        method === "pairwise"
          ? agreementResult.aggregation.dimension_pairwise_agreements
          : agreementResult.aggregation.dimension_consensus_agreements;
      filtered = filtered.filter((d) => {
        const score = scores[String(d.dimensionId)];
        return !isPerfectAgreement(score);
      });
    }

    return filtered;
  }, [dimensions, categoricalDimensions, conflictFilter, conflictsOnly, method, visibleColumnIds, agreementResult]);

  // Heatmap data
  const heatmapMatrix = useMemo(
    () => (agreementResult ? computeHeatmapMatrix(agreementResult.dimension_results, method) : []),
    [agreementResult, method],
  );

  const heatmapRowAverages = useMemo(() => computeRowAverages(heatmapMatrix), [heatmapMatrix]);
  const heatmapGrandAverage = useMemo(() => computeGrandAverage(heatmapMatrix), [heatmapMatrix]);

  // Per-dimension scores for bar chart
  const dimensionScores = useMemo(
    () => (agreementResult ? buildDimensionScores(agreementResult, method) : []),
    [agreementResult, method],
  );

  // Overall agreement
  const overallAgreement = useMemo(() => {
    if (!agreementResult) return null;
    return method === "pairwise"
      ? agreementResult.aggregation.pairwise_agreement
      : agreementResult.aggregation.consensus_agreement;
  }, [agreementResult, method]);

  // Conflict count
  const conflictCount = useMemo(
    () => (agreementResult ? countConflicts(agreementResult.aggregation, method) : 0),
    [agreementResult, method],
  );

  const hasAgreementData =
    agreementResult !== null &&
    agreementResult.dimension_results.length > 0 &&
    agreementResult.annotator_ids.length > 0;

  return {
    raw,
    agreementResult,
    dimensions,
    categoricalDimensions,
    filteredDimensions,
    annotators,
    heatmapMatrix,
    heatmapRowAverages,
    heatmapGrandAverage,
    dimensionScores,
    overallAgreement,
    conflictCount,
    isLoading,
    error: error as Error | null,
    hasAgreementData,
  };
}
