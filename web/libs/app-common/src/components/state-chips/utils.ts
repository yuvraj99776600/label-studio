/**
 * Shared utilities for state chip components
 */

// State color mapping following the 4-color system
// Grey: Initial states, Blue: In-progress, Yellow: Attention/Churn, Green: Terminal/Complete
export const STATE_COLORS: Record<string, string> = {
  // Grey - Initial
  CREATED: "grey",

  // Blue - In Progress
  ANNOTATION_IN_PROGRESS: "blue",
  REVIEW_IN_PROGRESS: "blue",
  ARBITRATION_IN_PROGRESS: "blue",
  IN_PROGRESS: "blue",

  // Yellow - Attention/Churn
  ARBITRATION_NEEDED: "yellow",

  // Green - Complete/Terminal
  ANNOTATION_COMPLETE: "green",
  REVIEW_COMPLETE: "green",
  ARBITRATION_COMPLETE: "green",
  COMPLETED: "green",
};

// Map colors to Tailwind CSS classes for chip styling
export const colorToClasses: Record<string, string> = {
  grey: "bg-neutral-emphasis border-neutral-border text-neutral-content",
  blue: "bg-primary-emphasis border-primary-border-subtlest text-primary-content",
  yellow: "bg-warning-emphasis border-warning-border-subtlest text-warning-content",
  green: "bg-positive-emphasis border-positive-border-subtlest text-positive-content",
};

/**
 * Get the color class for a given state
 */
export function getStateColorClass(state: string): string {
  const color = STATE_COLORS[state] || "grey";
  return colorToClasses[color];
}

// Human-readable labels for task states
export const stateLabels: Record<string, string> = {
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

/**
 * Format state name to human-readable label
 */
export function formatStateName(state: string): string {

  if (stateLabels[state]) {
    return stateLabels[state];
  }

  return state
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Get state description for tooltip
 */
export function getStateDescription(state: string): string {
  const stateDescriptions: Record<string, string> = {
    CREATED: "Task has been created and is ready for annotation",
    ANNOTATION_IN_PROGRESS: "Task is currently being annotated",
    ANNOTATION_COMPLETE: "Annotation has been completed",
    REVIEW_IN_PROGRESS: "Task is under review",
    REVIEW_COMPLETE: "Review has been completed",
    ARBITRATION_NEEDED: "Task requires arbitration due to disagreements",
    ARBITRATION_IN_PROGRESS: "Task is currently in arbitration",
    ARBITRATION_COMPLETE: "Arbitration has been completed",
    COMPLETED: "Task is fully complete",
    IN_PROGRESS: "In progress",
  };

  return stateDescriptions[state] || state;
}

/**
 * Format timestamp to human-readable string
 */
export function formatTimestamp(timestamp: string): string {
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

/**
 * Format user name from triggered_by object
 */
export function formatUserName(
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
