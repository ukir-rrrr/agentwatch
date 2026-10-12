import { getState, listEnabledMonitors, saveState } from "./db";
import { createNotifier, safeNotify } from "./notify";
import { evaluateDeadlines } from "./state-machine";

export async function runDeadlineChecks(env: Env, now: number): Promise<number> {
  const monitors = await listEnabledMonitors(env.DB);
  const notifier = createNotifier(env);
  let alertCount = 0;

  for (const monitor of monitors) {
    const state = await getState(env.DB, monitor.id);
    const { state: next, alerts } = evaluateDeadlines(monitor, state, now);
    await saveState(env.DB, monitor.id, next, now);
    for (const alert of alerts) {
      alertCount += 1;
      await safeNotify(notifier, { monitor, alert });
    }
  }

  return alertCount;
}
