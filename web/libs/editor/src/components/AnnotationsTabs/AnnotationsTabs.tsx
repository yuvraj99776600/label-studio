import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FixedSizeList as List } from "react-window";
import { observer } from "mobx-react";
import { IconPlus } from "@humansignal/icons";
import { Button, Dropdown, useDropdown } from "@humansignal/ui";
import { cn } from "../../utils/bem";
import { sortAnnotations } from "../../utils/utilities";
import { AnnotationButton } from "../AnnotationsCarousel/AnnotationButton";
import "./AnnotationsTabs.scss";

// Constants from AnnotationButton.scss
const TAB_MIN_WIDTH = 186; // min-width in SCSS
const TAB_GAP = 4; // gap between tabs (--spacing-tighter = 0.25rem = 4px)
const OVERFLOW_BUTTON_WIDTH = 80; // "+N" button approximate width
const ADD_BUTTON_WIDTH = 40; // "+" button width

// Virtualized list constants
const ITEM_HEIGHT = 42; // Height of each AnnotationButton in dropdown
const MAX_VISIBLE_ITEMS = 10;
const MAX_HEIGHT = ITEM_HEIGHT * MAX_VISIBLE_ITEMS;
const DROPDOWN_WIDTH = 220;

interface AnnotationsTabsProps {
  store: any;
  annotationStore: any;
  commentStore?: any;
}

interface VirtualizedOverflowMenuProps {
  entities: any[];
  store: any;
  annotationStore: any;
  capabilities: {
    enablePredictions: boolean;
    enableCreateAnnotation: boolean;
    groundTruthEnabled: boolean;
    enableAnnotations: boolean;
    enableAnnotationDelete: boolean;
  };
}

/**
 * Virtualized overflow menu for annotations that don't fit in the tab bar.
 * Uses react-window to efficiently render large lists of annotations.
 */
const VirtualizedOverflowMenu = memo(
  ({ entities, store, annotationStore, capabilities }: VirtualizedOverflowMenuProps) => {
    const rootClass = cn("annotations-tabs");
    const dropdown = useDropdown();

    // Calculate list height - shorter if fewer items
    const listHeight = Math.min(entities.length * ITEM_HEIGHT, MAX_HEIGHT);

    // Close dropdown when an annotation is selected
    const handleAnnotationClick = useCallback(() => {
      dropdown?.close?.();
    }, [dropdown]);

    const Row = useCallback(
      ({ index, style }: { index: number; style: React.CSSProperties }) => {
        const entity = entities[index];
        return (
          <div style={style} className={rootClass.elem("overflow-item").toClassName()} onClick={handleAnnotationClick}>
            <AnnotationButton
              key={entity?.id}
              entity={entity}
              store={store}
              capabilities={capabilities}
              annotationStore={annotationStore}
            />
          </div>
        );
      },
      [entities, store, annotationStore, capabilities, rootClass, handleAnnotationClick],
    );

    return (
      <div className={rootClass.elem("overflow-menu").toClassName()}>
        <List height={listHeight} itemCount={entities.length} itemSize={ITEM_HEIGHT} width={DROPDOWN_WIDTH}>
          {Row}
        </List>
      </div>
    );
  },
);

VirtualizedOverflowMenu.displayName = "VirtualizedOverflowMenu";

/**
 * AnnotationsTabs - A performant tab-based interface for annotation selection.
 *
 * Features:
 * - Estimated width calculation (no per-item measurement)
 * - Virtualized dropdown for overflow items (scales to 1000s of annotations)
 * - Constant render count regardless of annotation count
 *
 * Layout: [Tab 1] [Tab 2] ... [+N more ▾] [+ Add]
 */
export const AnnotationsTabs = observer(({ store, annotationStore }: AnnotationsTabsProps) => {
  const rootClass = cn("annotations-tabs");
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [entities, setEntities] = useState<any[]>([]);

  // Feature flags from store
  const enableAnnotations = store.hasInterface("annotations:tabs");
  const enablePredictions = store.hasInterface("predictions:tabs");
  const enableCreateAnnotation = store.hasInterface("annotations:add-new");
  const groundTruthEnabled = store.hasInterface("ground-truth");
  const enableAnnotationDelete = store.hasInterface("annotations:delete");

  const capabilities = useMemo(
    () => ({
      enablePredictions,
      enableCreateAnnotation,
      groundTruthEnabled,
      enableAnnotations,
      enableAnnotationDelete,
    }),
    [enablePredictions, enableCreateAnnotation, groundTruthEnabled, enableAnnotations, enableAnnotationDelete],
  );

  // Sync entities from annotationStore
  useEffect(() => {
    const newEntities = [];

    if (enablePredictions) newEntities.push(...annotationStore.predictions);
    if (enableAnnotations) newEntities.push(...annotationStore.annotations);

    setEntities(newEntities);
  }, [
    annotationStore,
    enableAnnotations,
    enablePredictions,
    // These trigger re-render when annotations/predictions change
    JSON.stringify(annotationStore.predictions),
    JSON.stringify(annotationStore.annotations),
  ]);

  // Sort entities for consistent display
  const sortedEntities = useMemo(() => sortAnnotations(entities), [entities]);

  // Calculate how many tabs fit using ESTIMATED width (no per-item measurement)
  const maxVisibleTabs = useMemo(() => {
    if (containerWidth === 0 || sortedEntities.length === 0) return sortedEntities.length;

    const totalEntities = sortedEntities.length;

    // Helper function to calculate total width needed for N tabs + buttons
    const calculateTotalWidth = (numTabs: number, hasOverflow: boolean): number => {
      // Width for N tabs: N * TAB_MIN_WIDTH
      const tabsWidth = numTabs * TAB_MIN_WIDTH;

      // Gaps between tabs: (N - 1) gaps if N > 0
      const gapsBetweenTabs = numTabs > 0 ? (numTabs - 1) * TAB_GAP : 0;

      // Gap after last tab before buttons (if there are tabs)
      const gapAfterTabs = numTabs > 0 ? TAB_GAP : 0;

      // Overflow button width + gap after it (if needed)
      const overflowWidth = hasOverflow ? OVERFLOW_BUTTON_WIDTH + TAB_GAP : 0;

      // Add button width (if enabled)
      const addButtonWidth = enableCreateAnnotation ? ADD_BUTTON_WIDTH : 0;

      return tabsWidth + gapsBetweenTabs + gapAfterTabs + overflowWidth + addButtonWidth;
    };

    // Try to fit all tabs without overflow
    const widthWithoutOverflow = calculateTotalWidth(totalEntities, false);
    if (widthWithoutOverflow <= containerWidth) {
      return totalEntities;
    }

    // Binary search to find maximum tabs that fit with overflow button
    let left = 1;
    let right = totalEntities - 1;
    let result = 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const widthWithOverflow = calculateTotalWidth(mid, true);

      if (widthWithOverflow <= containerWidth) {
        result = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return result;
  }, [containerWidth, sortedEntities.length, enableCreateAnnotation]);

  // Only slice the entities we need to render (O(1) slice, not O(n) render)
  const visibleEntities = useMemo(() => sortedEntities.slice(0, maxVisibleTabs), [sortedEntities, maxVisibleTabs]);

  const hiddenEntities = useMemo(() => sortedEntities.slice(maxVisibleTabs), [sortedEntities, maxVisibleTabs]);

  // Watch container size with ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setContainerWidth(width);
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Handler for creating new annotation
  const handleCreateAnnotation = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      const created = annotationStore.createAnnotation();
      annotationStore.selectAnnotation(created.id, { exitViewAll: true });
    },
    [annotationStore],
  );

  // Don't render if no annotation/prediction interfaces are enabled
  if (!enableAnnotations && !enablePredictions && !enableCreateAnnotation) {
    return null;
  }

  return (
    <div ref={containerRef} className={rootClass.toClassName()}>
      {/* Only render tabs that fit - O(maxVisibleTabs), not O(n) */}
      {visibleEntities.map((entity) => (
        <AnnotationButton
          key={entity?.id}
          entity={entity}
          store={store}
          capabilities={capabilities}
          annotationStore={annotationStore}
        />
      ))}

      {/* Overflow dropdown with virtualized list */}
      {hiddenEntities.length > 0 && (
        <Dropdown.Trigger
          content={
            <VirtualizedOverflowMenu
              entities={hiddenEntities}
              store={store}
              annotationStore={annotationStore}
              capabilities={capabilities}
            />
          }
        >
          <Button
            className={rootClass.elem("overflow-button").toClassName()}
            size="small"
            variant="neutral"
            look="outlined"
            aria-label={`Show ${hiddenEntities.length} more annotations`}
          >
            +{hiddenEntities.length}
          </Button>
        </Dropdown.Trigger>
      )}

      {/* Add button - always rightmost */}
      {enableCreateAnnotation && (
        <Button
          className={rootClass.elem("add-button").toClassName()}
          size="small"
          variant="neutral"
          look="outlined"
          aria-label="Create annotation"
          tooltip="Create a new annotation"
          onClick={handleCreateAnnotation}
        >
          <IconPlus />
        </Button>
      )}
    </div>
  );
});
