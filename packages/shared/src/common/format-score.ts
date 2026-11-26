// The one score formatter (BP-033, PRD Product Decision 17). It only formats numbers it is
// given: the API computes scores and percentages (ARCHITECTURE.md rule 1).
//
// Intl rounds the shortest decimal form of the number, half away from zero, so 2.005 shows
// as 2.01 even though its binary value is slightly below 2.005. A fixed locale keeps the
// server and every browser in agreement.
const pointsFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  useGrouping: false,
  signDisplay: "negative",
});

const percentFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  useGrouping: false,
  signDisplay: "negative",
});

// Points with at most 2 decimals: 0.5 -> "0.5", 1/3 -> "0.33", 10 -> "10".
export function formatPoints(points: number): string {
  return pointsFormat.format(points);
}

// A percentage already computed by the API (0-100), with at most 1 decimal: 66.666 -> "66.7%".
export function formatPercent(percent: number): string {
  return `${percentFormat.format(percent)}%`;
}
