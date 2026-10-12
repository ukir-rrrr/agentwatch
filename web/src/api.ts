import { getAdminToken } from "./storage";
import type { MonitorBody, MonitorSummary } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

async function request<T>(path: string, init: RequestInit = {}, admin = false): Promise<T> {
  const headers = new Headers(init.headers);
  if (admin) {
    const token = getAdminToken();
    if (!token) {
      throw new ApiError("管理トークンが未設定です", 401);
    }
    headers.set("authorization", `Bearer ${token}`);
  }
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(path, { ...init, headers });
  if (!response.ok) {
    throw new ApiError(await parseError(response), response.status);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function listMonitors(): Promise<MonitorSummary[]> {
  if (getAdminToken()) {
    try {
      const body = await request<{ monitors: MonitorSummary[] }>("/admin/monitors", {}, true);
      return body.monitors;
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
    }
  }
  const body = await request<{ monitors: MonitorSummary[] }>("/api/status");
  return body.monitors;
}

export async function getMonitor(id: string): Promise<MonitorSummary> {
  if (getAdminToken()) {
    return request<MonitorSummary>(`/admin/monitors/${id}`, {}, true);
  }
  const monitors = await listMonitors();
  const monitor = monitors.find((item) => item.id === id);
  if (!monitor) {
    throw new ApiError("not found", 404);
  }
  return monitor;
}

export async function createMonitor(body: MonitorBody): Promise<MonitorSummary> {
  return request<MonitorSummary>("/admin/monitors", { method: "POST", body: JSON.stringify(body) }, true);
}

export async function updateMonitor(id: string, body: Partial<MonitorBody>): Promise<MonitorSummary> {
  return request<MonitorSummary>(`/admin/monitors/${id}`, { method: "PATCH", body: JSON.stringify(body) }, true);
}

export async function deleteMonitor(id: string): Promise<void> {
  await request<{ ok: boolean }>(`/admin/monitors/${id}`, { method: "DELETE" }, true);
}
