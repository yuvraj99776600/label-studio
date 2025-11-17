/**
 * Formatters for FSM state history display
 */

// Map state values to human-readable labels
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

/**
 * Format state name from UPPER_SNAKE_CASE to readable format
 * Falls back to transforming the state name if not in the predefined list
 */
export function formatStateName(state: string): string {
  if (stateLabels[state]) {
    return stateLabels[state];
  }

  // Fallback: Convert UPPER_SNAKE_CASE to Title Case
  return state
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Format timestamp to localized, readable format
 */
export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  // Less than 1 minute
  if (diffMins < 1) {
    return "Just now";
  }

  // Less than 1 hour
  if (diffMins < 60) {
    return `${diffMins} ${diffMins === 1 ? "minute" : "minutes"} ago`;
  }

  // Less than 24 hours
  if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
  }

  // Less than 7 days
  if (diffDays < 7) {
    return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
  }

  // More than 7 days - show full date
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
 * Returns "System" if no user information is available
 */
export function formatUserName(
  triggeredBy: {
    first_name?: string;
    last_name?: string;
    email?: string;
  } | null,
): string {
  if (!triggeredBy) {
    return "System";
  }

  const { first_name, last_name, email } = triggeredBy;

  // Prefer full name
  if (first_name && last_name) {
    return `${first_name} ${last_name}`;
  }

  // Fall back to first name only
  if (first_name) {
    return first_name;
  }

  // Fall back to last name only
  if (last_name) {
    return last_name;
  }

  // Fall back to email
  if (email) {
    return email;
  }

  // No user information
  return "System";
}
