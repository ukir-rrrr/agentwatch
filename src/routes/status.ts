import { listSnapshots } from "../db";
import { html, json } from "../http";
import { formatSchedule } from "../schedule";

export async function handleStatusJson(env: Env): Promise<Response> {
  const snapshots = await listSnapshots(env.DB);
  return json({
    service: "agentwatch",
    monitors: snapshots.map(({ monitor, state }) => ({
      id: monitor.id,
      name: monitor.name,
      enabled: monitor.enabled,
      schedule: formatSchedule(monitor),
      status: state.status,
      alertingKind: state.alertingKind,
      lastStartAt: iso(state.lastStartAt),
      lastSuccessAt: iso(state.lastSuccessAt),
      lastFailAt: iso(state.lastFailAt),
      lastExpectedAt: iso(state.lastExpectedAt),
      lastAlertKind: state.lastAlertKind,
      lastAlertAt: iso(state.lastAlertAt),
    })),
  });
}

export async function handleStatusPage(env: Env): Promise<Response> {
  const snapshots = await listSnapshots(env.DB);
  const rows = snapshots
    .map(({ monitor, state }) => {
      const badge = state.status;
      return `<tr>
        <td>${escapeHtml(monitor.name)}</td>
        <td><span class="badge ${badge}">${badge}</span></td>
        <td>${escapeHtml(formatSchedule(monitor))}</td>
        <td>${iso(state.lastStartAt) ?? "—"}</td>
        <td>${iso(state.lastSuccessAt) ?? "—"}</td>
        <td>${state.alertingKind ?? state.lastAlertKind ?? "—"}</td>
      </tr>`;
    })
    .join("");

  return html(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>agentwatch</title>
  <style>
    :root { color-scheme: dark; }
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; background: #0f1419; color: #e7ecf1; }
    main { max-width: 960px; margin: 0 auto; padding: 32px 20px; }
    h1 { font-size: 1.4rem; margin: 0 0 4px; }
    p { color: #9aa8b5; margin: 0 0 24px; }
    table { width: 100%; border-collapse: collapse; background: #171e26; border-radius: 12px; overflow: hidden; }
    th, td { text-align: left; padding: 12px 14px; font-size: 0.92rem; }
    th { color: #9aa8b5; font-weight: 600; border-bottom: 1px solid #243040; }
    td { border-bottom: 1px solid #1d2733; }
    tr:last-child td { border-bottom: 0; }
    .badge { padding: 2px 8px; border-radius: 999px; font-size: 0.78rem; text-transform: uppercase; letter-spacing: .03em; }
    .ok { background: #143226; color: #5ee9a4; }
    .alerting { background: #3a1518; color: #ff8a8a; }
    .unknown { background: #2a3038; color: #c5cdd6; }
  </style>
</head>
<body>
  <main>
    <h1>agentwatch</h1>
    <p>read-only heartbeat status · tokens are hidden</p>
    <table>
      <thead>
        <tr><th>名前</th><th>状態</th><th>スケジュール</th><th>最終 start</th><th>最終 success</th><th>アラート</th></tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="6">モニターはまだありません</td></tr>`}
      </tbody>
    </table>
  </main>
</body>
</html>`);
}

function iso(value: number | null): string | null {
  return value == null ? null : new Date(value).toISOString();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
