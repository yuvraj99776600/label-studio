/**
 * TaskDataDock — Collapsible panel at the bottom of the Task Summary page
 * that shows task source data (images, text, audio, etc.).
 *
 * Features:
 * - Collapsed state shows a preview of available data fields + "Click to expand"
 * - Expanded state shows the full DataSummary content
 * - State persisted in localStorage
 * - Keyboard & ARIA support
 */

import type { ReactNode } from "react";
import { cnm } from "@humansignal/ui";
import { IconChevronDown } from "@humansignal/icons";
import { useTaskDataDock } from "./use-task-data-dock";
import type { ObjectTypes } from "./types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TaskDataDockProps {
  children: ReactNode;
  /** When true, shows an empty-state message instead of children. */
  isEmpty?: boolean;
  /** Data types to generate the collapsed preview from. */
  dataTypes?: ObjectTypes;
}

// ---------------------------------------------------------------------------
// Preview — compact summary of available data fields shown when collapsed
// ---------------------------------------------------------------------------

const MAX_PREVIEW_FIELDS = 4;

const DataPreview = ({ dataTypes }: { dataTypes: ObjectTypes }) => {
  const entries = Object.entries(dataTypes);
  if (entries.length === 0) return null;

  const shown = entries.slice(0, MAX_PREVIEW_FIELDS);
  const remaining = entries.length - shown.length;

  return (
    <span className="flex items-center gap-tight text-label-small text-neutral-content-subtle truncate">
      <span className="truncate">
        {shown.map(([field, { type }], i) => (
          <span key={field}>
            {i > 0 && <span className="mx-tightest">&middot;</span>}
            <span className="text-neutral-content-subtle">{field}</span>
            <span className="text-neutral-content-subtlest ml-tightest">({type})</span>
          </span>
        ))}
        {remaining > 0 && (
          <span className="text-neutral-content-subtlest ml-tightest">
            +{remaining} more
          </span>
        )}
      </span>
    </span>
  );
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const TaskDataDock = ({ children, isEmpty, dataTypes }: TaskDataDockProps) => {
  const dock = useTaskDataDock();

  return (
    <div
      className={cnm(
        "mb-base border border-neutral-border rounded-small overflow-hidden",
        "flex flex-col bg-neutral-surface",
      )}
    >
      {/* ── Title bar (entire bar is clickable to toggle collapse) ── */}
      <div
        role="button"
        tabIndex={0}
        onClick={dock.toggleCollapse}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            dock.toggleCollapse();
          }
        }}
        aria-expanded={!dock.isCollapsed}
        aria-label={dock.isCollapsed ? "Expand task data" : "Collapse task data"}
        className={cnm(
          "flex items-center gap-base px-base py-tight shrink-0",
          dock.isCollapsed
            ? "bg-neutral-surface"
            : "border-b border-neutral-border bg-neutral-surface",
          "select-none cursor-pointer hover:bg-neutral-surface-hover transition-colors",
        )}
      >
        {/* Left: title */}
        <span className="text-label-small font-semibold text-neutral-content shrink-0">
          Task Data
        </span>

        {/* Center: preview (collapsed only) */}
        {dock.isCollapsed && dataTypes && (
          <div className="flex-1 min-w-0 overflow-hidden">
            <DataPreview dataTypes={dataTypes} />
          </div>
        )}

        {/* Right: CTA / chevron */}
        <span
          className={cnm(
            "flex items-center gap-tightest px-tighter py-tightest rounded-smaller shrink-0 ml-auto",
            "text-label-small text-neutral-content-subtle",
          )}
          aria-hidden="true"
        >
          <IconChevronDown
            width={16}
            height={16}
            className={cnm(
              "transition-transform duration-150",
              dock.isCollapsed ? "rotate-0" : "rotate-180",
            )}
          />
          <span>{dock.isCollapsed ? "Click to expand" : "Collapse"}</span>
        </span>
      </div>

      {/* ── Content area ────────────────────────────────────────────── */}
      {!dock.isCollapsed && (
        <div
          className="overflow-y-auto overflow-x-auto"
          aria-label="Task source data"
        >
          {isEmpty ? (
            <div className="flex items-center justify-center py-relaxed text-neutral-content-subtle text-body-medium">
              No task data available
            </div>
          ) : (
            <div className="p-base">{children}</div>
          )}
        </div>
      )}
    </div>
  );
};
