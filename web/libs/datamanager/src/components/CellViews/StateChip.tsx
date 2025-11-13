/**
 * StateChip - Interactive state display with history popover
 */

import { useState } from "react";
import { Badge, Tooltip, Popover } from "@humansignal/ui";
import { IconSync, IconError, IconHistoryRewind } from "@humansignal/icons";
import { useStateHistory, type StateHistoryItem } from "@humansignal/app-common";

interface StateChipProps {
  state: string;
  label: string;
  description: string;
  colorClasses: string;
  entityType: "task" | "annotation" | "project";
  entityId?: number;
  interactive?: boolean;
}

// State color mapping following the 4-color system
const STATE_COLORS: Record<string, string> = {
  CREATED: "grey",
  ANNOTATION_IN_PROGRESS: "blue",
  REVIEW_IN_PROGRESS: "blue",
  ARBITRATION_IN_PROGRESS: "blue",
  IN_PROGRESS: "blue",
  ARBITRATION_NEEDED: "yellow",
  ANNOTATION_COMPLETE: "green",
  REVIEW_COMPLETE: "green",
  ARBITRATION_COMPLETE: "green",
  COMPLETED: "green",
};

const colorToClasses: Record<string, string> = {
  grey: "bg-neutral-emphasis border-neutral-border text-neutral-content",
  blue: "bg-primary-emphasis border-primary-border-subtlest text-primary-content",
  yellow: "bg-warning-emphasis border-warning-border-subtlest text-warning-content",
  green: "bg-positive-emphasis border-positive-border-subtlest text-positive-content",
};

function getStateColorClass(state: string): string {
  const color = STATE_COLORS[state] || "grey";
  return colorToClasses[color];
}

// Formatters
function formatStateName(state: string): string {
  const stateLabels: Record<string, string> = {
    CREATED: "Created",
    ANNOTATION_IN_PROGRESS: "Annotating",
    ANNOTATION_COMPLETE: "Annotated",
    REVIEW_IN_PROGRESS: "In Review",
    REVIEW_COMPLETE: "Reviewed",
    ARBITRATION_NEEDED: "Needs Arbitration",
    ARBITRATION_IN_PROGRESS: "In Arbitration",
    ARBITRATION_COMPLETE: "Arbitrated",
    COMPLETED: "Done",
    IN_PROGRESS: "In Progress",
  };

  if (stateLabels[state]) {
    return stateLabels[state];
  }

  return state
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? "minute" : "minutes"} ago`;
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatUserName(
  triggeredBy: {
    first_name?: string;
    last_name?: string;
    email?: string;
  } | null,
): string {
  if (!triggeredBy) return "System";

  const { first_name, last_name, email } = triggeredBy;

  if (first_name && last_name) return `${first_name} ${last_name}`;
  if (first_name) return first_name;
  if (last_name) return last_name;
  if (email) return email;

  return "System";
}

export function StateChip({
  state,
  label,
  description,
  colorClasses,
  entityType,
  entityId,
  interactive = true,
}: StateChipProps) {
  const [open, setOpen] = useState(false);

  // Fetch state history when popover is opened
  const { data, isLoading, isError, error, refetch } = useStateHistory({
    entityType,
    entityId: entityId || 0,
    enabled: open && !!entityId && interactive,
  });

  const history = (data?.results || []) as StateHistoryItem[];

  // Non-interactive chip - just show the badge with tooltip
  if (!interactive || !entityId) {
    return (
      <Tooltip title={description}>
        <span>
          <Badge className={colorClasses}>{label}</Badge>
        </span>
      </Tooltip>
    );
  }

  // Interactive chip with popover
  const trigger = (
    <button
      className="cursor-pointer outline-none hover:opacity-80 transition-opacity"
      onClick={(e) => {
        e.stopPropagation();
        setOpen(!open);
      }}
      type="button"
      title="Click to view state history"
    >
      <Badge className={colorClasses}>{label}</Badge>
    </button>
  );

  return (
    <Popover trigger={trigger} open={open} onOpenChange={setOpen} align="start" sideOffset={8}>
      <div
        className="flex flex-col w-[320px] max-h-[400px] bg-white dark:bg-gray-900 rounded-lg shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <IconHistoryRewind className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">State History</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <IconSync className="w-8 h-8 text-blue-500 animate-spin" />
              <span className="text-sm text-gray-500">Loading...</span>
            </div>
          )}

          {isError && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <IconError className="w-8 h-8 text-red-500" />
              <span className="text-sm text-gray-900 dark:text-gray-100">Failed to load history</span>
              <span className="text-xs text-gray-500 text-center">
                {error instanceof Error ? error.message : "Unknown error"}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  refetch();
                }}
                className="mt-2 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                type="button"
              >
                Retry
              </button>
            </div>
          )}

          {!isLoading && !isError && history.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <IconHistoryRewind className="w-8 h-8 text-gray-400" />
              <span className="text-sm text-gray-500">No history available</span>
            </div>
          )}

          {!isLoading && !isError && history.length > 0 && (
            <div className="space-y-3">
              {history.map((item: StateHistoryItem, index: number) => (
                <div key={index} className="pb-3 border-b border-gray-100 dark:border-gray-800 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={getStateColorClass(item.state)}>{formatStateName(item.state)}</Badge>
                    <span className="text-xs text-gray-500">{formatTimestamp(item.created_at)}</span>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    <div>By: {formatUserName(item.triggered_by)}</div>
                    {item.transition_name && <div className="mt-1 text-gray-500">{item.transition_name}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Popover>
  );
}
