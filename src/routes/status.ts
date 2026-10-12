import { displayStatus, iso, lastPingAt } from "../display-status";
import { listSnapshots } from "../db";
import { json } from "../http";
import { formatSchedule } from "../schedule";

export async function handleStatusJson(env: Env, now: number): Promise<Response> {
  const snapshots = await listSnapshots(env.DB);
  return json({
    service: "agentwatch",
    monitors: snapshots.map(({ monitor, state }) => ({
      id: monitor.id,
      name: monitor.name,
      enabled: monitor.enabled,
      schedule: formatSchedule(monitor),
      status: state.status,
      displayStatus: displayStatus(monitor, state, now),
      alertingKind: state.alertingKind,
      lastPingAt: iso(lastPingAt(state)),
      lastStartAt: iso(state.lastStartAt),
      lastSuccessAt: iso(state.lastSuccessAt),
      lastFailAt: iso(state.lastFailAt),
      lastExpectedAt: iso(state.lastExpectedAt),
      lastAlertKind: state.lastAlertKind,
      lastAlertAt: iso(state.lastAlertAt),
    })),
  });
}
