/**
 * Tests for math utilities (sum, mean, median, round).
 * Validates the es-toolkit re-exports behave as expected.
 */

import { mean, median, round, sum } from "./math";

describe("sum", () => {
  it("sums an array of numbers", () => {
    expect(sum([1, 2, 3, 4, 5])).toBe(15);
  });

  it("returns 0 for an empty array", () => {
    expect(sum([])).toBe(0);
  });

  it("handles negative numbers", () => {
    expect(sum([-2, -1, 15, -151, 172])).toBe(33);
  });

  it("handles single-element arrays", () => {
    expect(sum([42])).toBe(42);
  });
});

describe("mean", () => {
  it("computes the arithmetic mean", () => {
    expect(mean([1, 2, 3, 4, 5])).toBe(3);
    expect(mean([1, 2, 3, 4, 5, 6])).toBe(3.5);
  });

  it("returns NaN for an empty array", () => {
    expect(mean([])).toBeNaN();
  });

  it("handles negative numbers", () => {
    expect(mean([-2, -1, 15, -151, 172])).toBeCloseTo(6.6);
  });
});

describe("median", () => {
  it("returns the middle value for odd-length arrays", () => {
    expect(median([1, 2, 3, 4, 5])).toBe(3);
    expect(median([1, 2, 3, 4, 5, 6, 7])).toBe(4);
  });

  it("returns the average of two middle values for even-length arrays", () => {
    expect(median([1, 2, 3, 4, 5, 6])).toBe(3.5);
    expect(median([1, 2, 3, 4, 5, 6, 7, 8])).toBe(4.5);
  });

  it("handles unsorted input", () => {
    expect(median([-2, -1, 15, -151, 172])).toBe(-1);
  });

  it("returns NaN for an empty array", () => {
    expect(median([])).toBeNaN();
  });
});

describe("round", () => {
  it("rounds to specified precision", () => {
    expect(round(1.2345, 2)).toBe(1.23);
    expect(round(1.2355, 2)).toBe(1.24);
  });

  it("rounds to zero decimal places by default", () => {
    expect(round(1.5)).toBe(2);
    expect(round(1.4)).toBe(1);
  });

  it("handles negative numbers", () => {
    expect(round(-1.5, 0)).toBe(-1);
    expect(round(-1.55, 1)).toBe(-1.5);
  });

  it("returns the number unchanged when precision is sufficient", () => {
    expect(round(5, 2)).toBe(5);
  });
});
