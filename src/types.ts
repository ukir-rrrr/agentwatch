export type ScheduleKind = "cron" | "period";

export type MonitorStatus = "ok" | "alerting" | "unknown";

export type AlertKind = "never_started" | "unfinished" | "failed" | "recovered";

export type PingAction = "start" | "success" | "fail";

export type Monitor = {
  id: string;
  name: string;
  scheduleKind: ScheduleKind;
  cronExpr: string | null;
  periodSeconds: number | null;
  graceSeconds: number;
  maxRuntimeSeconds: number;
  pingToken: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
};

export type RuntimeState = {
  status: MonitorStatus;
  lastStartAt: number | null;
  lastSuccessAt: number | null;
  lastFailAt: number | null;
  lastExpectedAt: number | null;
  currentRunStartedAt: number | null;
  alertingKind: Exclude<AlertKind, "recovered"> | null;
  lastAlertKind: AlertKind | null;
  lastAlertAt: number | null;
  lastAlertSlot: number | null;
  lastAlertRunStartedAt: number | null;
};

export type PingRecord = {
  id: string;
  monitorId: string;
  action: PingAction;
  at: number;
};

export type Alert = {
  kind: AlertKind;
  at: number;
  expectedAt?: number;
  startedAt?: number;
  detail: string;
};

export type Transition = {
  state: RuntimeState;
  alerts: Alert[];
};

export type CreateMonitorInput = {
  name: string;
  cron?: string;
  periodSeconds?: number;
  graceSeconds: number;
  maxRuntimeSeconds: number;
};
