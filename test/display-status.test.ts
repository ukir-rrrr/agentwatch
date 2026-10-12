import { describe, expect, it } from "vitest";
import { displayStatus } from "../src/display-status";
import { makeMonitor, makeState, ts } from "./helpers";

const expected = ts("2026-10-12T10:00:00Z");

describe("displayStatus", () => {
  it("maps alerting kinds", () => {
    const monitor = makeMonitor();
    expect(displayStatus(monitor, makeState({ alertingKind: "never_started" }), expected)).toBe("never_started");
    expect(displayStatus(monitor, makeState({ alertingKind: "unfinished" }), expected)).toBe("unfinished");
    expect(displayStatus(monitor, makeState({ alertingKind: "failed" }), expected)).toBe("failed");
  });

  it("is late when the slot is overdue but still inside grace", () => {
    const monitor = makeMonitor({ graceSeconds: 300 });
    const state = makeState({ lastExpectedAt: expected });
    expect(displayStatus(monitor, state, ts("2026-10-12T10:02:00Z"))).toBe("late");
  });

  it("is ok after an on-time success", () => {
    const monitor = makeMonitor();
    const state = makeState({
      status: "ok",
      lastExpectedAt: expected,
      lastSuccessAt: ts("2026-10-12T10:00:20Z"),
    });
    expect(displayStatus(monitor, state, ts("2026-10-12T10:06:00Z"))).toBe("ok");
  });
});
