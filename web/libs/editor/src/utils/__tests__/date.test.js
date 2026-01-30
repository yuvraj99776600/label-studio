/* global describe, test, expect, jest, beforeEach, afterEach */
import { msToHMS, prettyDate } from "../date";

describe("Helper function prettyDate", () => {
  // Fixed reference time (noon UTC) for deterministic tests across timezones
  const REFERENCE_TIME = new Date("2024-06-15T12:00:00.000Z");

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(REFERENCE_TIME);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("Undefined", () => {
    expect(prettyDate(undefined)).toBeUndefined();
    expect(prettyDate(null)).toBeUndefined();
    expect(prettyDate(123)).toBeUndefined();
  });

  test("Yesterday", () => {
    const resultDate = new Date("2024-06-14T12:00:00.000Z");
    expect(prettyDate(resultDate.toISOString())).toBe("Yesterday");
  });

  test("2 days ago", () => {
    const resultDate = new Date("2024-06-13T12:00:00.000Z");
    expect(prettyDate(resultDate.toISOString())).toBe("2 days ago");
  });

  test("2 weeks ago", () => {
    const resultDate = new Date("2024-06-01T12:00:00.000Z");
    expect(prettyDate(resultDate.toISOString())).toBe("2 weeks ago");
  });

  test("100 days ago", () => {
    const resultDate = new Date("2024-03-07T12:00:00.000Z");
    expect(prettyDate(resultDate.toISOString())).toBe("100 days ago");
  });
});

describe("Helper function msToHMS", () => {
  test("Correct", () => {
    expect(msToHMS(10000)).toBe("0:0:10");
  });
});
