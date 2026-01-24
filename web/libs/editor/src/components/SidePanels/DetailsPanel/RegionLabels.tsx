import { memo, useMemo, type FC } from "react";
import { observer } from "mobx-react";

import { cn } from "../../../utils/bem";

// Memoized label item component to prevent unnecessary re-renders
const LabelItem = memo(({ label, showComma }: { label: any; showComma: boolean }) => {
  const color = label.background || "#000000";

  return (
    <>
      {showComma ? ", " : null}
      <span style={{ color }}>{label.value}</span>
    </>
  );
});

LabelItem.displayName = "LabelItem";

export const RegionLabels: FC<{ region: LSFRegion }> = observer(({ region }) => {
  // Memoize label extraction to prevent recalculation on every render
  const labels = useMemo(() => {
    const labelsInResults = region.labelings.map((result: any) => result.selectedLabels || []);

    return ([] as any[]).concat(...labelsInResults);
  }, [region.labelings]);

  if (!labels.length) return <div className={cn("labels-list").toClassName()}>{region.noLabelView || "No label"}</div>;

  return (
    <div className={cn("labels-list").toClassName()}>
      {labels.map((label, index) => (
        <LabelItem key={label.id} label={label} showComma={index > 0} />
      ))}
    </div>
  );
});
