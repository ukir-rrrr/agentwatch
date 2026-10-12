export type DisplayStatus = "ok" | "late" | "never_started" | "unfinished" | "failed" | "unknown";

export type PingAction = "start" | "success" | "fail";

export type MonitorSummary = {
  id: string;
  name: string;
  enabled: boolean;
  schedule: string;
  scheduleKind?: "cron" | "period";
  cron?: string | null;
  periodSeconds?: number | null;
  graceSeconds?: number;
  maxRuntimeSeconds?: number;
  status: string;
  displayStatus: DisplayStatus;
  alertingKind: string | null;
  lastPingAt: string | null;
  lastStartAt: string | null;
  lastSuccessAt: string | null;
  lastFailAt: string | null;
  lastExpectedAt: string | null;
  lastAlertKind: string | null;
  lastAlertAt: string | null;
  pingToken?: string;
  urls?: {
    start: string;
    success: string;
    fail: string;
  };
  recentPings?: Array<{
    id: string;
    action: PingAction;
    at: string | null;
  }>;
};

export type MonitorBody = {
  name: string;
  cron?: string;
  periodSeconds?: number;
  graceSeconds: number;
  maxRuntimeSeconds: number;
  enabled?: boolean;
};
