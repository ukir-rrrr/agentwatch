import { describe, expect, it } from "vitest";
import { lastExpectedStart, previousCronOccurrence } from "../src/schedule";
import { makeMonitor, makeState, ts } from "./helpers";

describe("cron previous occurrence", () => {
  it("returns the current minute when it matches", () => {
    expect(previousCronOccurrence("0 * * * *", ts("2026-10-12T10:00:00Z"))).toBe(ts("2026-10-12T10:00:00Z"));
  });

  it("walks back to the last hour mark", () => {
    expect(previousCronOccurrence("0 * * * *", ts("2026-10-12T10:37:12Z"))).toBe(ts("2026-10-12T10:00:00Z"));
  });

  it("supports lists, ranges, and steps", () => {
    expect(previousCronOccurrence("*/15 9-17 * * 1-5", ts("2026-10-12T10:07:00Z"))).toBe(
      ts("2026-10-12T10:00:00Z"),
    );
  });
});

describe("period expected start", () => {
  it("expects the first run one period after creation", () => {
    const monitor = makeMonitor({
      scheduleKind: "period",
      cronExpr: null,
      periodSeconds: 3600,
      createdAt: ts("2026-10-12T09:00:00Z"),
    });
    expect(lastExpectedStart(monitor, makeState(), ts("2026-10-12T10:30:00Z"))).toBe(
      ts("2026-10-12T10:00:00Z"),
    );
  });

  it("uses last success as the next period anchor", () => {
    const monitor = makeMonitor({
      scheduleKind: "period",
      cronExpr: null,
      periodSeconds: 3600,
    });
    const state = makeState({ lastSuccessAt: ts("2026-10-12T10:00:20Z") });
    expect(lastExpectedStart(monitor, state, ts("2026-10-12T11:10:00Z"))).toBe(ts("2026-10-12T11:00:20Z"));
  });
});
