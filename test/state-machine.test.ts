import { describe, expect, it } from "vitest";
import { applyFailPing, applyStartPing, applySuccessPing, evaluateDeadlines } from "../src/state-machine";
import { makeMonitor, makeState, ts } from "./helpers";

const T10 = ts("2026-10-12T10:00:00Z");
const T1005 = ts("2026-10-12T10:00:05Z");
const T1020 = ts("2026-10-12T10:00:20Z");
const T1004 = ts("2026-10-12T10:04:00Z");
const T1006 = ts("2026-10-12T10:06:00Z");
const T1010 = ts("2026-10-12T10:10:00Z");
const T0210 = ts("2026-10-12T10:02:10Z");

describe("state machine", () => {
  it("on-time: start then success before deadlines produces no alert", () => {
    const monitor = makeMonitor();
    let state = makeState();

    ({ state } = applyStartPing(state, T1005));
    ({ state } = applySuccessPing(state, T1020));
    const checked = evaluateDeadlines(monitor, state, T1006);

    expect(checked.alerts).toEqual([]);
    expect(checked.state.status).toBe("ok");
    expect(checked.state.alertingKind).toBeNull();
  });

  it("late: success after the scheduled time but within grace stays OK", () => {
    const monitor = makeMonitor();
    let state = makeState();

    const duringGrace = evaluateDeadlines(monitor, state, T1004);
    expect(duringGrace.alerts).toEqual([]);
    expect(duringGrace.state.status).toBe("unknown");

    ({ state } = applySuccessPing(duringGrace.state, T1004));
    const afterGrace = evaluateDeadlines(monitor, state, T1006);

    expect(afterGrace.alerts).toEqual([]);
    expect(afterGrace.state.status).toBe("ok");
  });

  it("never started: no start/success after grace, and does not duplicate", () => {
    const monitor = makeMonitor();
    const first = evaluateDeadlines(monitor, makeState(), T1006);

    expect(first.alerts).toHaveLength(1);
    expect(first.alerts[0]?.kind).toBe("never_started");
    expect(first.alerts[0]?.expectedAt).toBe(T10);
    expect(first.state.status).toBe("alerting");
    expect(first.state.alertingKind).toBe("never_started");

    const second = evaluateDeadlines(monitor, first.state, T1010);
    expect(second.alerts).toEqual([]);
    expect(second.state.alertingKind).toBe("never_started");
  });

  it("started-not-finished: distinguishes an unfinished run from never started", () => {
    const monitor = makeMonitor();
    let state = makeState();
    ({ state } = applyStartPing(state, T1005));

    const timedOut = evaluateDeadlines(monitor, state, T0210);
    expect(timedOut.alerts).toHaveLength(1);
    expect(timedOut.alerts[0]?.kind).toBe("unfinished");
    expect(timedOut.alerts[0]?.startedAt).toBe(T1005);
    expect(timedOut.state.status).toBe("alerting");
    expect(timedOut.state.alertingKind).toBe("unfinished");
    expect(timedOut.state.currentRunStartedAt).toBeNull();

    const again = evaluateDeadlines(monitor, timedOut.state, T1006);
    expect(again.alerts.map((alert) => alert.kind)).not.toContain("never_started");
    expect(again.alerts).toEqual([]);
  });

  it("fail: reports fail once for the same run", () => {
    const monitor = makeMonitor();
    let state = makeState();
    ({ state } = applyStartPing(state, T1005));

    const failed = applyFailPing(state, T1020);
    expect(failed.alerts).toHaveLength(1);
    expect(failed.alerts[0]?.kind).toBe("failed");
    expect(failed.state.status).toBe("alerting");

    const duplicate = applyFailPing(failed.state, T1004);
    expect(duplicate.alerts).toEqual([]);
    expect(duplicate.state.alertingKind).toBe("failed");

    const laterCheck = evaluateDeadlines(monitor, failed.state, T1006);
    expect(laterCheck.alerts).toEqual([]);
  });

  it("recovery: success after an alert sends a single recovery notice", () => {
    const monitor = makeMonitor();
    const missed = evaluateDeadlines(monitor, makeState(), T1006);
    expect(missed.alerts[0]?.kind).toBe("never_started");

    const recovered = applySuccessPing(missed.state, T1010);
    expect(recovered.alerts).toHaveLength(1);
    expect(recovered.alerts[0]?.kind).toBe("recovered");
    expect(recovered.state.status).toBe("ok");
    expect(recovered.state.alertingKind).toBeNull();

    const stillOk = applySuccessPing(recovered.state, T1010 + 1_000);
    expect(stillOk.alerts).toEqual([]);
    expect(stillOk.state.status).toBe("ok");
  });
});
