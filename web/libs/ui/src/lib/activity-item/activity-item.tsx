/**
 * ActivityItem - A reusable component for displaying activity items with a consistent layout
 * Used for comments, state history, and other activity-like displays
 */

import type { ReactNode } from "react";
import clsx from "clsx";
import styles from "./activity-item.module.scss";

export interface ActivityItemProps {
  /** Primary content/label (badge, state, etc.) - displayed prominently on first row */
  label?: ReactNode;
  /** Timestamp or secondary info on the right of the first row */
  timestamp?: ReactNode;
  /** Attribution row content (e.g., "username" with optional userpic) */
  attribution?: ReactNode;
  /** Additional content below the header and attribution */
  children?: ReactNode;
  /** Optional className for customization */
  className?: string;
}

export function ActivityItem({ label, timestamp, attribution, children, className }: ActivityItemProps) {
  return (
    <div className={clsx(styles.activityItem, className)}>
      <div className={styles.header}>
        {label && <div className={styles.label}>{label}</div>}
        {timestamp && <div className={styles.timestamp}>{timestamp}</div>}
      </div>
      {attribution && <div className={styles.attribution}>{attribution}</div>}
      {children && <div className={styles.content}>{children}</div>}
    </div>
  );
}
