import type { Monitor, RuntimeState } from "./types";

export type DisplayStatus = "ok" | "late" | "never_started" | "unfinished" | "failed" | "unknown";

export function displayStatus(
  monitor: Pick<Monitor, "graceSeconds">,
  state: RuntimeState,
  now: number,
): DisplayStatus {
  if (state.alertingKind === "never_started") return "never_started";
  if (state.alertingKind === "unfinished") return "unfinished";
  if (state.alertingKind === "failed") return "failed";

  const expected = state.lastExpectedAt;
  if (expected != null) {
    const graceEnd = expected + monitor.graceSeconds * 1000;
    const satisfied =
      (state.lastSuccessAt != null && state.lastSuccessAt >= expected) ||
      (state.lastFailAt != null && state.lastFailAt >= expected) ||
      (state.lastStartAt != null && state.lastStartAt >= expected);
    if (!satisfied && now >= expected && now < graceEnd) {
      return "late";
    }
  }

  if (state.status === "ok") return "ok";
  return "unknown";
}

export function lastPingAt(state: RuntimeState): number | null {
  let max: number | null = null;
  for (const value of [state.lastStartAt, state.lastSuccessAt, state.lastFailAt]) {
    if (value == null) continue;
    if (max == null || value > max) max = value;
  }
  return max;
}

export function iso(value: number | null): string | null {
  return value == null ? null : new Date(value).toISOString();
}
