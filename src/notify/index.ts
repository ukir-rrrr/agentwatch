import { LineNotifier } from "./line";
import type { Notifier, Notification } from "./types";

export type { Notifier, Notification } from "./types";
export { formatNotification } from "./message";
export { LineNotifier } from "./line";

/**
 * Small fan-out so email / Slack / Discord / webhook notifiers can be
 * added later without changing the checker.
 */
export class FanoutNotifier implements Notifier {
  readonly channel = "fanout";

  constructor(private readonly notifiers: Notifier[]) {}

  async send(notification: Notification): Promise<void> {
    const results = await Promise.allSettled(this.notifiers.map((notifier) => notifier.send(notification)));
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    if (failures.length > 0) {
      const messages = failures.map((failure) => String(failure.reason)).join("; ");
      throw new Error(`一部の通知に失敗しました: ${messages}`);
    }
  }
}

export class NoopNotifier implements Notifier {
  readonly channel = "noop";
  async send(): Promise<void> {}
}

export function createNotifier(env: Env, fetchImpl: typeof fetch = fetch): Notifier {
  const notifiers: Notifier[] = [];
  if (env.LINE_CHANNEL_ACCESS_TOKEN && env.LINE_USER_ID) {
    notifiers.push(new LineNotifier(env.LINE_CHANNEL_ACCESS_TOKEN, env.LINE_USER_ID, fetchImpl));
  }
  // Future: EmailNotifier, SlackNotifier, DiscordNotifier, WebhookNotifier
  return notifiers.length > 0 ? new FanoutNotifier(notifiers) : new NoopNotifier();
}

export async function safeNotify(notifier: Notifier, notification: Notification): Promise<void> {
  try {
    await notifier.send(notification);
  } catch (error) {
    console.error("notify failed", error);
  }
}
