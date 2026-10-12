import { lastExpectedStart } from "./schedule";
import type { Alert, AlertKind, Monitor, RuntimeState, Transition } from "./types";

export function emptyState(): RuntimeState {
  return {
    status: "unknown",
    lastStartAt: null,
    lastSuccessAt: null,
    lastFailAt: null,
    lastExpectedAt: null,
    currentRunStartedAt: null,
    alertingKind: null,
    lastAlertKind: null,
    lastAlertAt: null,
    lastAlertSlot: null,
    lastAlertRunStartedAt: null,
  };
}

export function applyStartPing(state: RuntimeState, now: number): Transition {
  return {
    state: {
      ...state,
      lastStartAt: now,
      currentRunStartedAt: now,
    },
    alerts: [],
  };
}

export function applySuccessPing(state: RuntimeState, now: number): Transition {
  const recovered = state.status === "alerting";
  const next: RuntimeState = {
    ...state,
    status: "ok",
    lastSuccessAt: now,
    currentRunStartedAt: null,
    alertingKind: null,
  };

  if (!recovered) {
    return { state: next, alerts: [] };
  }

  next.lastAlertKind = "recovered";
  next.lastAlertAt = now;
  return {
    state: next,
    alerts: [
      alert("recovered", now, {
        detail: "success ping を受信し、モニターは OK に戻りました",
      }),
    ],
  };
}

export function applyFailPing(state: RuntimeState, now: number): Transition {
  const runStartedAt = state.currentRunStartedAt ?? state.lastAlertRunStartedAt ?? now;
  const alreadyFailedThisRun =
    state.status === "alerting" &&
    state.alertingKind === "failed" &&
    (state.currentRunStartedAt == null || state.lastAlertRunStartedAt === state.currentRunStartedAt);

  const next: RuntimeState = {
    ...state,
    status: "alerting",
    lastFailAt: now,
    currentRunStartedAt: null,
    alertingKind: "failed",
  };

  if (alreadyFailedThisRun) {
    return { state: next, alerts: [] };
  }

  next.lastAlertKind = "failed";
  next.lastAlertAt = now;
  next.lastAlertRunStartedAt = runStartedAt;
  return {
    state: next,
    alerts: [
      alert("failed", now, {
        startedAt: state.currentRunStartedAt ?? undefined,
        detail: "ジョブが fail ping を報告しました",
      }),
    ],
  };
}

export function evaluateDeadlines(monitor: Monitor, state: RuntimeState, now: number): Transition {
  if (!monitor.enabled) {
    return { state, alerts: [] };
  }

  const alerts: Alert[] = [];
  let next = { ...state };

  if (next.currentRunStartedAt != null) {
    const runtimeDeadline = next.currentRunStartedAt + monitor.maxRuntimeSeconds * 1000;
    if (now >= runtimeDeadline) {
      const already =
        next.lastAlertKind === "unfinished" && next.lastAlertRunStartedAt === next.currentRunStartedAt;
      if (!already) {
        alerts.push(
          alert("unfinished", now, {
            startedAt: next.currentRunStartedAt,
            detail: `start ping のあと ${monitor.maxRuntimeSeconds}s 以内に success/fail がありません`,
          }),
        );
        next.status = "alerting";
        next.alertingKind = "unfinished";
        next.lastAlertKind = "unfinished";
        next.lastAlertAt = now;
        next.lastAlertRunStartedAt = next.currentRunStartedAt;
      }
      next.currentRunStartedAt = null;
    } else {
      return { state: next, alerts };
    }
  }

  const expected = lastExpectedStart(monitor, next, now);
  if (expected == null) {
    return { state: next, alerts };
  }
  next.lastExpectedAt = expected;

  const slotSatisfied =
    (next.lastSuccessAt != null && next.lastSuccessAt >= expected) ||
    (next.lastFailAt != null && next.lastFailAt >= expected) ||
    (next.lastStartAt != null && next.lastStartAt >= expected);

  if (!slotSatisfied && now >= expected + monitor.graceSeconds * 1000) {
    const already = next.lastAlertKind === "never_started" && next.lastAlertSlot === expected;
    if (!already) {
      alerts.push(
        alert("never_started", now, {
          expectedAt: expected,
          detail: `予定時刻 ${formatUtc(expected)} から ${monitor.graceSeconds}s の猶予内に start/success がありません`,
        }),
      );
      next.status = "alerting";
      next.alertingKind = "never_started";
      next.lastAlertKind = "never_started";
      next.lastAlertAt = now;
      next.lastAlertSlot = expected;
    }
  }

  return { state: next, alerts };
}

function alert(
  kind: AlertKind,
  at: number,
  extra: { expectedAt?: number; startedAt?: number; detail: string },
): Alert {
  return { kind, at, ...extra };
}

function formatUtc(ms: number): string {
  return new Date(ms).toISOString().replace(".000Z", "Z");
}
