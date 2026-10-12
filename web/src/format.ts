import type { DisplayStatus, PingAction } from "./types";

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  ok: "OK",
  late: "遅延",
  never_started: "未起動",
  unfinished: "未完了",
  failed: "失敗",
  unknown: "不明",
};

export const PING_LABEL: Record<PingAction, string> = {
  start: "開始",
  success: "成功",
  fail: "失敗",
};

export const ALERT_LABEL: Record<string, string> = {
  never_started: "未起動",
  unfinished: "未完了",
  failed: "失敗",
  recovered: "復旧",
};

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "UTC",
  }).format(date) + " UTC";
}
