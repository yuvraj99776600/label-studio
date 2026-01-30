import { IconArrow, IconCheck, IconDocument } from "@humansignal/icons";
import { inject, observer } from "mobx-react";
import { type FC, useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "../../../utils/bem";
import { Dropdown } from "@humansignal/ui";
// eslint-disable-next-line
// @ts-ignore
import { Menu } from "../../../common/Menu/Menu";
import { EmptyState } from "../Components/EmptyState";
import "./PagesPanel.scss";

type FilterMode = "all" | "annotated" | "unannotated";

const PAGES_FILTER_STORAGE_KEY = "lsf:pages-panel:filter";

const getStoredFilterMode = (): FilterMode => {
  try {
    const stored = window.localStorage.getItem(PAGES_FILTER_STORAGE_KEY);
    if (stored === "all" || stored === "annotated" || stored === "unannotated") {
      return stored;
    }
  } catch (e) {
    // localStorage not available
  }
  return "all";
};

const setStoredFilterMode = (mode: FilterMode): void => {
  try {
    window.localStorage.setItem(PAGES_FILTER_STORAGE_KEY, mode);
  } catch (e) {
    // localStorage not available
  }
};

interface PageLabel {
  value: string;
  color: string;
}

interface PageData {
  pageIndex: number;
  pageNumber: number;
  labels: PageLabel[];
}

interface PagesPanelProps {
  currentEntity: any;
  store?: any;
}

/**
 * PagesPanel displays a navigable list of PDF pages as a standalone tab.
 * Shows page numbers with classification labels and filtering options.
 */
const PagesPanelComponent: FC<PagesPanelProps> = ({ currentEntity }) => {
  const [filterMode, setFilterMode] = useState<FilterMode>(getStoredFilterMode);
  const annotation = currentEntity;

  // Persist filter mode changes to localStorage
  const handleFilterChange = useCallback((mode: FilterMode) => {
    setFilterMode(mode);
    setStoredFilterMode(mode);
  }, []);

  // Find PDF objects with multi-item support
  const pdfObjects = useMemo(() => {
    if (!annotation?.objects) return [];
    return annotation.objects.filter(
      (obj: any) => obj.type === "pdf" && obj.isMultiItem && obj._numPages > 0
    );
  }, [annotation?.objects]);

  // If no PDF objects with multi-item support, show empty state
  if (pdfObjects.length === 0) {
    return (
      <div className={cn("pages-panel").toClassName()}>
        <div className={cn("pages-panel").elem("section-tab").toClassName()}>
          <EmptyState
            icon={<IconDocument width={24} height={24} />}
            header="No PDF document loaded"
            description={<>Load a multi-page PDF to navigate between pages</>}
          />
        </div>
      </div>
    );
  }

  // Use the first PDF object (typically there's only one)
  const pdfObject = pdfObjects[0];
  const numPages = pdfObject._numPages || 0;
  const currentPageIndex = pdfObject.currentItemIndex ?? 0;

  // Get classification labels for each page
  const pageClassifications = useMemo(() => {
    if (!annotation?.areas) return {};

    const areas = Array.from(annotation.areas.values());
    const byPage: Record<number, PageLabel[]> = {};

    for (const area of areas) {
      // Only consider classification areas with item_index (perItem classifications)
      if (!area.classification || area.item_index === null || area.item_index === undefined) {
        continue;
      }

      const pageIdx = area.item_index;
      if (!byPage[pageIdx]) byPage[pageIdx] = [];

      // Extract labels from results
      for (const result of area.results || []) {
        const choices = result.mainValue || result.value?.choices || [];
        const choiceValues = Array.isArray(choices) ? choices : [choices];

        for (const choiceValue of choiceValues) {
          if (!choiceValue) continue;

          // Try to get the color from the control tag
          const controlTag = result.from_name;
          const labelInfo = controlTag?.findLabel?.(choiceValue);
          const color = labelInfo?.background || "#666";

          byPage[pageIdx].push({
            value: String(choiceValue),
            color,
          });
        }
      }
    }

    return byPage;
  }, [annotation?.areas]);

  // Build page data array
  const allPages: PageData[] = useMemo(() => {
    return Array.from({ length: numPages }, (_, i) => ({
      pageIndex: i,
      pageNumber: i + 1,
      labels: pageClassifications[i] || [],
    }));
  }, [numPages, pageClassifications]);

  // Apply filter
  const filteredPages = useMemo(() => {
    switch (filterMode) {
      case "annotated":
        return allPages.filter((page) => page.labels.length > 0);
      case "unannotated":
        return allPages.filter((page) => page.labels.length === 0);
      default:
        return allPages;
    }
  }, [allPages, filterMode]);

  // Counts for display
  const annotatedCount = allPages.filter((p) => p.labels.length > 0).length;

  const handlePageClick = useCallback(
    (pageIndex: number) => {
      pdfObject.setCurrentItem(pageIndex);
    },
    [pdfObject]
  );

  const rootClass = cn("pages-panel");

  return (
    <div className={rootClass.toClassName()}>
      <div className={rootClass.elem("section-tab").toClassName()}>
        {/* Header with counts and filter */}
        <div className={rootClass.elem("header").toClassName()}>
          <div className={rootClass.elem("header-info").toClassName()}>
            <span className={rootClass.elem("header-title").toClassName()}>
              Pages ({numPages})
            </span>
            <span className={rootClass.elem("header-stats").toClassName()}>
              {annotatedCount} labeled
            </span>
          </div>
          <FilterDropdown
            value={filterMode}
            onChange={handleFilterChange}
            counts={{
              all: allPages.length,
              annotated: annotatedCount,
              unannotated: allPages.length - annotatedCount,
            }}
          />
        </div>

        {/* Pages List */}
        <div className={rootClass.elem("list").toClassName()}>
          {filteredPages.length === 0 ? (
            <div className={rootClass.elem("empty").toClassName()}>
              No pages match the filter
            </div>
          ) : (
            filteredPages.map((page) => (
              <PageItem
                key={page.pageIndex}
                page={page}
                isCurrent={page.pageIndex === currentPageIndex}
                onClick={() => handlePageClick(page.pageIndex)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

interface FilterDropdownProps {
  value: FilterMode;
  onChange: (value: FilterMode) => void;
  counts: {
    all: number;
    annotated: number;
    unannotated: number;
  };
}

const FilterDropdown: FC<FilterDropdownProps> = ({ value, onChange, counts }) => {
  const options: { key: FilterMode; label: string; count: number }[] = [
    { key: "all", label: "All Pages", count: counts.all },
    { key: "annotated", label: "Labeled", count: counts.annotated },
    { key: "unannotated", label: "Unlabeled", count: counts.unannotated },
  ];

  const selectedOption = options.find((o) => o.key === value) || options[0];

  const dropdownContent = (
    <Menu size="medium" style={{ width: 160, minWidth: 160 }} selectedKeys={[value]}>
      {options.map((option) => (
        <Menu.Item key={option.key} name={option.key} onClick={() => onChange(option.key)}>
          <div className={cn("pages-panel").elem("filter-option").toClassName()}>
            <span>{option.label}</span>
            <span className={cn("pages-panel").elem("filter-count").toClassName()}>
              {option.count}
            </span>
          </div>
        </Menu.Item>
      ))}
    </Menu>
  );

  return (
    <Dropdown.Trigger content={dropdownContent}>
      <button
        type="button"
        className={cn("pages-panel").elem("filter-button").toClassName()}
      >
        <span>{selectedOption.label}</span>
        <IconArrow />
      </button>
    </Dropdown.Trigger>
  );
};

interface PageItemProps {
  page: PageData;
  isCurrent: boolean;
  onClick: () => void;
}

const PageItem: FC<PageItemProps> = ({ page, isCurrent, onClick }) => {
  const rootClass = cn("pages-panel");
  const hasLabels = page.labels.length > 0;

  return (
    <div
      className={rootClass
        .elem("item")
        .mod({ current: isCurrent, annotated: hasLabels })
        .toClassName()}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div className={rootClass.elem("item-header").toClassName()}>
        <span className={rootClass.elem("item-number").toClassName()}>
          {page.pageNumber}
        </span>
        <span className={rootClass.elem("item-title").toClassName()}>
          Page {page.pageNumber}
        </span>
        {isCurrent && (
          <span className={rootClass.elem("item-current-indicator").toClassName()}>
            <IconCheck width={14} height={14} />
          </span>
        )}
      </div>
      <div className={rootClass.elem("item-labels").toClassName()}>
        {hasLabels ? (
          page.labels.map((label, idx) => (
            <span key={idx} className={rootClass.elem("label").toClassName()}>
              <span
                className={rootClass.elem("label-dot").toClassName()}
                style={{ backgroundColor: label.color }}
              />
              <span className={rootClass.elem("label-text").toClassName()}>
                {label.value}
              </span>
            </span>
          ))
        ) : (
          <span className={rootClass.elem("no-labels").toClassName()}>
            No labels
          </span>
        )}
      </div>
    </div>
  );
};

export const Pages = inject("store")(observer(PagesPanelComponent));
