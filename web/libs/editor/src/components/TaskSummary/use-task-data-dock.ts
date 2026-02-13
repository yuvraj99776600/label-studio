/**
 * useTaskDataDock — manages collapse/expand state with localStorage persistence
 * for the Task Data Dock panel.
 *
 * The dock appears at the bottom of the Task Summary page and can be toggled
 * between a collapsed preview bar and a fully expanded content view.
 */

import { useCallback, useEffect, useMemo } from "react";
import { useLocalStorage } from "@/utils/hooks";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface TaskDataDockState {
  isCollapsed: boolean;
  toggleCollapse: () => void;
  /** Props to spread on the collapse / expand button. */
  collapseButtonProps: {
    onClick: () => void;
    "aria-expanded": boolean;
    "aria-label": string;
  };
}

export function useTaskDataDock(): TaskDataDockState {
  // ── Persisted state ────────────────────────────────────────────────────
  const [isCollapsed, setIsCollapsed] = useLocalStorage<boolean>(
    "task_data_dock_collapsed",
    true,
  );

  // ── Toggle collapse ────────────────────────────────────────────────────
  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, [setIsCollapsed]);

  // ── Shift+D global shortcut ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === "D" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Don't trigger when typing in inputs / textareas
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if ((e.target as HTMLElement)?.isContentEditable) return;

        e.preventDefault();
        toggleCollapse();
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [toggleCollapse]);

  // ── Assembled return value ─────────────────────────────────────────────
  const collapseButtonProps = useMemo(
    () => ({
      onClick: toggleCollapse,
      "aria-expanded": !isCollapsed,
      "aria-label": isCollapsed ? "Expand task data" : "Collapse task data",
    }),
    [toggleCollapse, isCollapsed],
  );

  return {
    isCollapsed,
    toggleCollapse,
    collapseButtonProps,
  };
}
