import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FixedSizeList as List } from "react-window";
import { observer } from "mobx-react";
import { IconPlus } from "@humansignal/icons";
import { Button, Dropdown } from "@humansignal/ui";
import { cn } from "../../utils/bem";
import { sortAnnotations } from "../../utils/utilities";
import { AnnotationButton } from "../AnnotationsCarousel/AnnotationButton";
import "./AnnotationsTabs.scss";

// Constants from AnnotationButton.scss
const TAB_MIN_WIDTH = 186; // min-width in SCSS
const TAB_GAP = 4; // gap between tabs (--spacing-tighter)
const OVERFLOW_BUTTON_WIDTH = 80; // "+N" button approximate width
const ADD_BUTTON_WIDTH = 40; // "+" button width

// Virtualized list constants
const ITEM_HEIGHT = 56; // Height of each AnnotationButton in dropdown
const MAX_VISIBLE_ITEMS = 8;
const MAX_HEIGHT = ITEM_HEIGHT * MAX_VISIBLE_ITEMS;
const DROPDOWN_WIDTH = 280;

interface AnnotationsTabsProps {
  store: any;
  annotationStore: any;
  commentStore?: any;
}

interface VirtualizedOverflowMenuProps {
  entities: any[];
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
  ({ entities, annotationStore, capabilities }: VirtualizedOverflowMenuProps) => {
    const rootClass = cn("annotations-tabs");

    // Calculate list height - shorter if fewer items
    const listHeight = Math.min(entities.length * ITEM_HEIGHT, MAX_HEIGHT);

    const Row = useCallback(
      ({ index, style }: { index: number; style: React.CSSProperties }) => {
        const entity = entities[index];
        return (
          <div style={style} className={rootClass.elem("overflow-item").toClassName()}>
            <AnnotationButton
              key={entity?.id}
              entity={entity}
              capabilities={capabilities}
              annotationStore={annotationStore}
            />
          </div>
        );
      },
      [entities, annotationStore, capabilities, rootClass],
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

    // Reserve space for add button
    let reservedWidth = enableCreateAnnotation ? ADD_BUTTON_WIDTH + TAB_GAP : 0;

    // If there might be overflow, reserve space for overflow button
    const tabWidthWithGap = TAB_MIN_WIDTH + TAB_GAP;
    const availableWidthForTabs = containerWidth - reservedWidth;
    const maxPossibleTabs = Math.floor(availableWidthForTabs / tabWidthWithGap);

    // If not all tabs fit, we need space for overflow button
    if (maxPossibleTabs < sortedEntities.length) {
      reservedWidth += OVERFLOW_BUTTON_WIDTH + TAB_GAP;
    }

    const finalAvailableWidth = containerWidth - reservedWidth;
    const visibleCount = Math.max(1, Math.floor(finalAvailableWidth / tabWidthWithGap));

    return Math.min(visibleCount, sortedEntities.length);
  }, [containerWidth, sortedEntities.length, enableCreateAnnotation]);

  // Only slice the entities we need to render (O(1) slice, not O(n) render)
  const visibleEntities = useMemo(
    () => sortedEntities.slice(0, maxVisibleTabs),
    [sortedEntities, maxVisibleTabs],
  );

  const hiddenEntities = useMemo(
    () => sortedEntities.slice(maxVisibleTabs),
    [sortedEntities, maxVisibleTabs],
  );

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
