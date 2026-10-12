import { emptyState } from "./state-machine";
import type { CreateMonitorInput, Monitor, PingAction, PingRecord, RuntimeState } from "./types";

type MonitorRow = {
  id: string;
  name: string;
  schedule_kind: "cron" | "period";
  cron_expr: string | null;
  period_seconds: number | null;
  grace_seconds: number;
  max_runtime_seconds: number;
  ping_token: string;
  enabled: number;
  created_at: number;
  updated_at: number;
};

type StateRow = {
  monitor_id: string;
  status: RuntimeState["status"];
  last_start_at: number | null;
  last_success_at: number | null;
  last_fail_at: number | null;
  last_expected_at: number | null;
  current_run_started_at: number | null;
  alerting_kind: RuntimeState["alertingKind"];
  last_alert_kind: RuntimeState["lastAlertKind"];
  last_alert_at: number | null;
  last_alert_slot: number | null;
  last_alert_run_started_at: number | null;
  updated_at: number;
};

export function generateId(): string {
  return crypto.randomUUID();
}

export function generatePingToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createMonitor(db: D1Database, input: CreateMonitorInput, now: number): Promise<Monitor> {
  const monitor: Monitor = {
    id: generateId(),
    name: input.name,
    scheduleKind: input.cron ? "cron" : "period",
    cronExpr: input.cron ?? null,
    periodSeconds: input.periodSeconds ?? null,
    graceSeconds: input.graceSeconds,
    maxRuntimeSeconds: input.maxRuntimeSeconds,
    pingToken: generatePingToken(),
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };

  await db.batch([
    db
      .prepare(
        `INSERT INTO monitors (
           id, name, schedule_kind, cron_expr, period_seconds,
           grace_seconds, max_runtime_seconds, ping_token, enabled, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .bind(
        monitor.id,
        monitor.name,
        monitor.scheduleKind,
        monitor.cronExpr,
        monitor.periodSeconds,
        monitor.graceSeconds,
        monitor.maxRuntimeSeconds,
        monitor.pingToken,
        monitor.createdAt,
        monitor.updatedAt,
      ),
    db
      .prepare(
        `INSERT INTO monitor_state (
           monitor_id, status, updated_at
         ) VALUES (?, 'unknown', ?)`,
      )
      .bind(monitor.id, now),
  ]);

  return monitor;
}

export async function listMonitors(db: D1Database): Promise<Monitor[]> {
  const { results } = await db.prepare("SELECT * FROM monitors ORDER BY created_at ASC").all<MonitorRow>();
  return (results ?? []).map(toMonitor);
}

export async function listEnabledMonitors(db: D1Database): Promise<Monitor[]> {
  const { results } = await db
    .prepare("SELECT * FROM monitors WHERE enabled = 1 ORDER BY created_at ASC")
    .all<MonitorRow>();
  return (results ?? []).map(toMonitor);
}

export async function getMonitor(db: D1Database, id: string): Promise<Monitor | null> {
  const row = await db.prepare("SELECT * FROM monitors WHERE id = ?").bind(id).first<MonitorRow>();
  return row ? toMonitor(row) : null;
}

export async function getMonitorByToken(db: D1Database, token: string): Promise<Monitor | null> {
  const row = await db.prepare("SELECT * FROM monitors WHERE ping_token = ?").bind(token).first<MonitorRow>();
  return row ? toMonitor(row) : null;
}

export async function deleteMonitor(db: D1Database, id: string): Promise<boolean> {
  await db.prepare("DELETE FROM pings WHERE monitor_id = ?").bind(id).run();
  await db.prepare("DELETE FROM monitor_state WHERE monitor_id = ?").bind(id).run();
  const result = await db.prepare("DELETE FROM monitors WHERE id = ?").bind(id).run();
  return (result.meta.changes ?? 0) > 0;
}

export async function updateMonitor(
  db: D1Database,
  id: string,
  patch: Partial<CreateMonitorInput> & { enabled?: boolean },
  now: number,
): Promise<Monitor | null> {
  const current = await getMonitor(db, id);
  if (!current) return null;

  const next: Monitor = {
    ...current,
    name: patch.name ?? current.name,
    graceSeconds: patch.graceSeconds ?? current.graceSeconds,
    maxRuntimeSeconds: patch.maxRuntimeSeconds ?? current.maxRuntimeSeconds,
    enabled: patch.enabled ?? current.enabled,
    updatedAt: now,
  };

  if (patch.cron != null) {
    next.scheduleKind = "cron";
    next.cronExpr = patch.cron;
    next.periodSeconds = null;
  } else if (patch.periodSeconds != null) {
    next.scheduleKind = "period";
    next.periodSeconds = patch.periodSeconds;
    next.cronExpr = null;
  }

  await db
    .prepare(
      `UPDATE monitors SET
         name = ?, schedule_kind = ?, cron_expr = ?, period_seconds = ?,
         grace_seconds = ?, max_runtime_seconds = ?, enabled = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      next.name,
      next.scheduleKind,
      next.cronExpr,
      next.periodSeconds,
      next.graceSeconds,
      next.maxRuntimeSeconds,
      next.enabled ? 1 : 0,
      next.updatedAt,
      next.id,
    )
    .run();

  return next;
}

export async function getState(db: D1Database, monitorId: string): Promise<RuntimeState> {
  const row = await db
    .prepare("SELECT * FROM monitor_state WHERE monitor_id = ?")
    .bind(monitorId)
    .first<StateRow>();
  return row ? toState(row) : emptyState();
}

export async function saveState(db: D1Database, monitorId: string, state: RuntimeState, now: number): Promise<void> {
  await db
    .prepare(
      `UPDATE monitor_state SET
         status = ?, last_start_at = ?, last_success_at = ?, last_fail_at = ?,
         last_expected_at = ?, current_run_started_at = ?, alerting_kind = ?,
         last_alert_kind = ?, last_alert_at = ?, last_alert_slot = ?,
         last_alert_run_started_at = ?, updated_at = ?
       WHERE monitor_id = ?`,
    )
    .bind(
      state.status,
      state.lastStartAt,
      state.lastSuccessAt,
      state.lastFailAt,
      state.lastExpectedAt,
      state.currentRunStartedAt,
      state.alertingKind,
      state.lastAlertKind,
      state.lastAlertAt,
      state.lastAlertSlot,
      state.lastAlertRunStartedAt,
      now,
      monitorId,
    )
    .run();
}

const PING_HISTORY_LIMIT = 50;

export async function recordPing(
  db: D1Database,
  monitorId: string,
  action: PingAction,
  now: number,
): Promise<void> {
  await db
    .prepare("INSERT INTO pings (id, monitor_id, action, at) VALUES (?, ?, ?, ?)")
    .bind(generateId(), monitorId, action, now)
    .run();

  const cutoff = await db
    .prepare("SELECT at FROM pings WHERE monitor_id = ? ORDER BY at DESC LIMIT 1 OFFSET ?")
    .bind(monitorId, PING_HISTORY_LIMIT - 1)
    .first<{ at: number }>();
  if (cutoff) {
    await db
      .prepare("DELETE FROM pings WHERE monitor_id = ? AND at < ?")
      .bind(monitorId, cutoff.at)
      .run();
  }
}

export async function listRecentPings(db: D1Database, monitorId: string): Promise<PingRecord[]> {
  const { results } = await db
    .prepare("SELECT id, monitor_id, action, at FROM pings WHERE monitor_id = ? ORDER BY at DESC LIMIT ?")
    .bind(monitorId, PING_HISTORY_LIMIT)
    .all<{ id: string; monitor_id: string; action: PingAction; at: number }>();
  return (results ?? []).map((row) => ({
    id: row.id,
    monitorId: row.monitor_id,
    action: row.action,
    at: row.at,
  }));
}

export type MonitorSnapshot = {
  monitor: Monitor;
  state: RuntimeState;
};

export async function listSnapshots(db: D1Database): Promise<MonitorSnapshot[]> {
  const monitors = await listMonitors(db);
  const snapshots: MonitorSnapshot[] = [];
  for (const monitor of monitors) {
    snapshots.push({ monitor, state: await getState(db, monitor.id) });
  }
  return snapshots;
}

function toMonitor(row: MonitorRow): Monitor {
  return {
    id: row.id,
    name: row.name,
    scheduleKind: row.schedule_kind,
    cronExpr: row.cron_expr,
    periodSeconds: row.period_seconds,
    graceSeconds: row.grace_seconds,
    maxRuntimeSeconds: row.max_runtime_seconds,
    pingToken: row.ping_token,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toState(row: StateRow): RuntimeState {
  return {
    status: row.status,
    lastStartAt: row.last_start_at,
    lastSuccessAt: row.last_success_at,
    lastFailAt: row.last_fail_at,
    lastExpectedAt: row.last_expected_at,
    currentRunStartedAt: row.current_run_started_at,
    alertingKind: row.alerting_kind,
    lastAlertKind: row.last_alert_kind,
    lastAlertAt: row.last_alert_at,
    lastAlertSlot: row.last_alert_slot,
    lastAlertRunStartedAt: row.last_alert_run_started_at,
  };
}
