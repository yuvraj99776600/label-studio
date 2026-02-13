/**
 * Inter-Annotator Agreement Heatmap Matrix (§4)
 *
 * Visualizes pairwise agreement between every annotator pair as a
 * color-coded N×N matrix. Includes row/column marginal averages
 * and a grand average in the corner.
 */

import { cnm, Tooltip } from "@humansignal/ui";
import { getHeatmapCellStyle } from "./agreement-utils";
import type { AnnotatorInfo } from "./types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AgreementHeatmapProps {
  matrix: number[][];
  annotators: AnnotatorInfo[];
  rowAverages: number[];
  grandAverage: number;
}

// ---------------------------------------------------------------------------
// Color Legend
// ---------------------------------------------------------------------------

const ColorLegend = () => (
  <div className="flex items-center gap-tight mt-tight">
    <span className="text-label-small text-neutral-content-subtle">0.0</span>
    <div
      className="h-3 flex-1 rounded-smallest"
      style={{
        background:
          "linear-gradient(to right, var(--color-negative-surface), var(--color-warning-surface), var(--color-positive-surface))",
      }}
    />
    <span className="text-label-small text-neutral-content-subtle">1.0</span>
  </div>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const AgreementHeatmap = ({
  matrix,
  annotators,
  rowAverages,
  grandAverage,
}: AgreementHeatmapProps) => {
  const n = matrix.length;

  if (n === 0) {
    return (
      <div className="text-neutral-content-subtle text-label-small italic p-base">
        No annotator data available for heatmap.
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table
          className="border-collapse"
          aria-label={`Pairwise agreement heatmap between ${n} annotators. Grand average: ${grandAverage.toFixed(2)}`}
        >
          <thead>
            <tr>
              {/* Empty corner cell */}
              <th className="p-1" />
              {/* Column headers (annotator names) */}
              {annotators.map((ann) => (
                <th
                  key={ann.id}
                  className="p-1 text-label-small font-medium text-neutral-content-subtle"
                  style={{ writingMode: "vertical-lr", textOrientation: "mixed", maxWidth: 40 }}
                  title={ann.displayName}
                >
                  <span className="block max-w-[4rem] truncate">{ann.displayName}</span>
                </th>
              ))}
              {/* Marginal average column header */}
              <th className="p-1 text-label-small font-semibold text-neutral-content-subtle border-l-2 border-neutral-border-bold">
                Avg
              </th>
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={annotators[i]?.id ?? i}>
                {/* Row header (annotator name) */}
                <td
                  className="pr-tight text-label-small font-medium text-neutral-content-subtle whitespace-nowrap text-right"
                  title={annotators[i]?.displayName}
                >
                  <span className="block max-w-[6rem] truncate text-right">
                    {annotators[i]?.displayName ?? `#${i}`}
                  </span>
                </td>

                {/* Score cells */}
                {row.map((score, j) => {
                  const isDiagonal = i === j;
                  const label = isDiagonal
                    ? `${annotators[i]?.displayName}: self (1.00)`
                    : `${annotators[i]?.displayName} vs ${annotators[j]?.displayName}: ${score.toFixed(2)}`;

                  return (
                    <td key={annotators[j]?.id ?? j} className="p-0.5">
                      <Tooltip title={label}>
                        <div
                          className={cnm(
                            "w-10 h-10 flex items-center justify-center rounded-smallest text-label-small font-medium cursor-default transition-shadow hover:ring-2 hover:ring-primary-border",
                            isDiagonal && "bg-neutral-surface-subtle",
                          )}
                          style={isDiagonal ? undefined : getHeatmapCellStyle(score)}
                          role="cell"
                          aria-label={label}
                        >
                          {score.toFixed(2)}
                        </div>
                      </Tooltip>
                    </td>
                  );
                })}

                {/* Row marginal average */}
                <td className="p-0.5 border-l-2 border-neutral-border-bold">
                  <div className="w-10 h-10 flex items-center justify-center rounded-smallest text-label-small font-semibold bg-neutral-surface-subtle">
                    {rowAverages[i]?.toFixed(2) ?? "—"}
                  </div>
                </td>
              </tr>
            ))}

            {/* Bottom marginal averages row */}
            <tr>
              <td className="pr-tight text-label-small font-semibold text-neutral-content-subtle text-right border-t-2 border-neutral-border-bold">
                Avg
              </td>
              {/* Column averages (same as row averages since matrix is symmetric) */}
              {rowAverages.map((avg, j) => (
                <td key={j} className="p-0.5 border-t-2 border-neutral-border-bold">
                  <div className="w-10 h-10 flex items-center justify-center rounded-smallest text-label-small font-semibold bg-neutral-surface-subtle">
                    {avg.toFixed(2)}
                  </div>
                </td>
              ))}
              {/* Grand average */}
              <td className="p-0.5 border-t-2 border-l-2 border-neutral-border-bold">
                <div className="w-10 h-10 flex items-center justify-center rounded-smallest text-label-small font-bold bg-neutral-surface-subtle">
                  {grandAverage.toFixed(2)}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <ColorLegend />
    </div>
  );
};
