import { emptyState } from "../src/state-machine";
import type { Monitor, RuntimeState } from "../src/types";

export function ts(iso: string): number {
  return Date.parse(iso);
}

export function makeMonitor(overrides: Partial<Monitor> = {}): Monitor {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    name: "cron-job",
    scheduleKind: "cron",
    cronExpr: "0 * * * *",
    periodSeconds: null,
    graceSeconds: 300,
    maxRuntimeSeconds: 120,
    pingToken: "token",
    enabled: true,
    createdAt: ts("2026-10-12T08:00:00Z"),
    updatedAt: ts("2026-10-12T08:00:00Z"),
    ...overrides,
  };
}

export function makeState(overrides: Partial<RuntimeState> = {}): RuntimeState {
  return { ...emptyState(), ...overrides };
}
