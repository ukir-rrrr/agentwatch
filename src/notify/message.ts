import type { AlertKind } from "../types";
import type { Notification } from "./types";

const KIND_LABEL: Record<AlertKind, string> = {
  never_started: "未起動 (never_started)",
  unfinished: "実行中に停止 (started but unfinished)",
  failed: "失敗 (failed)",
  recovered: "復旧 (recovered)",
};

export function formatNotification(notification: Notification): string {
  const { monitor, alert } = notification;
  const title = alert.kind === "recovered" ? "【agentwatch】復旧" : "【agentwatch】障害";
  const lines = [
    title,
    `モニター: ${monitor.name}`,
    `種別: ${KIND_LABEL[alert.kind]}`,
    `時刻: ${new Date(alert.at).toISOString()}`,
  ];
  if (alert.expectedAt != null) {
    lines.push(`予定: ${new Date(alert.expectedAt).toISOString()}`);
  }
  if (alert.startedAt != null) {
    lines.push(`開始: ${new Date(alert.startedAt).toISOString()}`);
  }
  lines.push(alert.detail);
  return lines.join("\n");
}
