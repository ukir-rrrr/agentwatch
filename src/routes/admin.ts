import { parseCron } from "../schedule";
import {
  createMonitor,
  deleteMonitor,
  getMonitor,
  getState,
  listMonitors,
  updateMonitor,
} from "../db";
import { json, readJson } from "../http";
import type { CreateMonitorInput, Monitor } from "../types";

type MonitorBody = {
  name?: string;
  cron?: string;
  periodSeconds?: number;
  graceSeconds?: number;
  maxRuntimeSeconds?: number;
  enabled?: boolean;
};

export async function handleAdmin(
  request: Request,
  env: Env,
  id: string | undefined,
  now: number,
): Promise<Response> {
  if (!id && request.method === "GET") {
    const monitors = await listMonitors(env.DB);
    const items = [];
    for (const monitor of monitors) {
      items.push(await serializeMonitor(env.DB, monitor, request));
    }
    return json({ monitors: items });
  }

  if (!id && request.method === "POST") {
    const body = await readJson<MonitorBody>(request);
    const input = validateCreate(body);
    if (input instanceof Response) return input;
    const monitor = await createMonitor(env.DB, input, now);
    return json(await serializeMonitor(env.DB, monitor, request), 201);
  }

  if (!id) {
    return json({ error: "method not allowed" }, 405);
  }

  if (request.method === "GET") {
    const monitor = await getMonitor(env.DB, id);
    if (!monitor) return json({ error: "not found" }, 404);
    return json(await serializeMonitor(env.DB, monitor, request));
  }

  if (request.method === "PATCH") {
    const body = await readJson<MonitorBody>(request);
    const error = validatePatch(body);
    if (error) return error;
    const monitor = await updateMonitor(env.DB, id, body, now);
    if (!monitor) return json({ error: "not found" }, 404);
    return json(await serializeMonitor(env.DB, monitor, request));
  }

  if (request.method === "DELETE") {
    const deleted = await deleteMonitor(env.DB, id);
    if (!deleted) return json({ error: "not found" }, 404);
    return json({ ok: true });
  }

  return json({ error: "method not allowed" }, 405);
}

async function serializeMonitor(db: D1Database, monitor: Monitor, request: Request) {
  const state = await getState(db, monitor.id);
  const origin = new URL(request.url).origin;
  const base = `${origin}/ping/${monitor.pingToken}`;
  return {
    id: monitor.id,
    name: monitor.name,
    scheduleKind: monitor.scheduleKind,
    cron: monitor.cronExpr,
    periodSeconds: monitor.periodSeconds,
    graceSeconds: monitor.graceSeconds,
    maxRuntimeSeconds: monitor.maxRuntimeSeconds,
    enabled: monitor.enabled,
    pingToken: monitor.pingToken,
    urls: {
      start: `${base}/start`,
      success: base,
      fail: `${base}/fail`,
    },
    status: state.status,
    alertingKind: state.alertingKind,
    lastStartAt: iso(state.lastStartAt),
    lastSuccessAt: iso(state.lastSuccessAt),
    lastFailAt: iso(state.lastFailAt),
    lastExpectedAt: iso(state.lastExpectedAt),
    lastAlertKind: state.lastAlertKind,
    lastAlertAt: iso(state.lastAlertAt),
    createdAt: iso(monitor.createdAt),
    updatedAt: iso(monitor.updatedAt),
  };
}

function validateCreate(body: MonitorBody): CreateMonitorInput | Response {
  if (!body.name?.trim()) {
    return json({ error: "name is required" }, 400);
  }
  const schedule = validateSchedule(body);
  if (schedule instanceof Response) return schedule;
  if (body.graceSeconds == null || body.graceSeconds < 0) {
    return json({ error: "graceSeconds must be >= 0" }, 400);
  }
  if (body.maxRuntimeSeconds == null || body.maxRuntimeSeconds <= 0) {
    return json({ error: "maxRuntimeSeconds must be > 0" }, 400);
  }
  return {
    name: body.name.trim(),
    cron: schedule.cron,
    periodSeconds: schedule.periodSeconds,
    graceSeconds: body.graceSeconds,
    maxRuntimeSeconds: body.maxRuntimeSeconds,
  };
}

function validatePatch(body: MonitorBody): Response | null {
  if (body.cron != null || body.periodSeconds != null) {
    const schedule = validateSchedule(body);
    if (schedule instanceof Response) return schedule;
  }
  if (body.graceSeconds != null && body.graceSeconds < 0) {
    return json({ error: "graceSeconds must be >= 0" }, 400);
  }
  if (body.maxRuntimeSeconds != null && body.maxRuntimeSeconds <= 0) {
    return json({ error: "maxRuntimeSeconds must be > 0" }, 400);
  }
  return null;
}

function validateSchedule(body: MonitorBody): { cron?: string; periodSeconds?: number } | Response {
  const hasCron = body.cron != null && body.cron !== "";
  const hasPeriod = body.periodSeconds != null;
  if (hasCron === hasPeriod) {
    return json({ error: "exactly one of cron or periodSeconds is required" }, 400);
  }
  if (hasCron) {
    try {
      parseCron(body.cron as string);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "invalid cron" }, 400);
    }
    return { cron: body.cron };
  }
  if ((body.periodSeconds as number) <= 0) {
    return json({ error: "periodSeconds must be > 0" }, 400);
  }
  return { periodSeconds: body.periodSeconds };
}

function iso(value: number | null): string | null {
  return value == null ? null : new Date(value).toISOString();
}
