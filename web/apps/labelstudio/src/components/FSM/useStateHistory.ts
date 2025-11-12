/**
 * Hook for fetching state history from the API
 */

import { useQuery } from "@tanstack/react-query";
import { getApiInstance } from "@humansignal/core/lib/api-provider/api-instance";

export interface StateHistoryItem {
  state: string;
  created_at: string;
  triggered_by: {
    first_name?: string;
    last_name?: string;
    email?: string;
  } | null;
  previous_state?: string;
  transition_name?: string;
  reason?: string;
}

export interface StateHistoryResponse {
  results: StateHistoryItem[];
}

export interface UseStateHistoryOptions {
  entityType: "task" | "annotation" | "project";
  entityId: number;
  enabled?: boolean;
}

/**
 * Hook to fetch state transition history for an entity
 *
 * @param options - Configuration options
 * @returns Query result with state history data
 */
export function useStateHistory({ entityType, entityId, enabled = true }: UseStateHistoryOptions) {
  const queryKey = ["state-history", entityType, entityId];

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const api = getApiInstance();

      // Construct the endpoint based on entity type
      const endpoint = `/api/${entityType}s/${entityId}/state-history/`;

      try {
        const response = await fetch(endpoint, {
          headers: {
            "Content-Type": "application/json",
            // Add any necessary auth headers
          },
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch state history: ${response.statusText}`);
        }

        const result = await response.json();
        return result as StateHistoryResponse;
      } catch (error) {
        console.error("Error fetching state history:", error);
        throw error;
      }
    },
    enabled: enabled && !!entityId,
    staleTime: 30 * 1000, // Cache for 30 seconds
    cacheTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    retry: 2,
  });

  return { data, isLoading, isError, error, refetch };
}
