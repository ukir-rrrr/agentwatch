import { getMonitorByToken, getState, saveState } from "../db";
import { text } from "../http";
import { createNotifier, safeNotify } from "../notify";
import { applyFailPing, applyStartPing, applySuccessPing } from "../state-machine";
import type { Transition } from "../types";

export type PingAction = "start" | "success" | "fail";

export async function handlePing(
  env: Env,
  token: string,
  action: PingAction,
  now: number,
): Promise<Response> {
  const monitor = await getMonitorByToken(env.DB, token);
  if (!monitor) {
    return text("not found", 404);
  }

  const state = await getState(env.DB, monitor.id);
  const transition: Transition =
    action === "start"
      ? applyStartPing(state, now)
      : action === "fail"
        ? applyFailPing(state, now)
        : applySuccessPing(state, now);

  await saveState(env.DB, monitor.id, transition.state, now);

  if (transition.alerts.length > 0) {
    const notifier = createNotifier(env);
    for (const alert of transition.alerts) {
      await safeNotify(notifier, { monitor, alert });
    }
  }

  return text("ok");
}
