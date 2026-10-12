import type { Notifier, Notification } from "./types";
import { formatNotification } from "./message";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

export class LineNotifier implements Notifier {
  readonly channel = "line";

  constructor(
    private readonly accessToken: string,
    private readonly userId: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(notification: Notification): Promise<void> {
    const text = formatNotification(notification);
    const response = await this.fetchImpl(LINE_PUSH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: this.userId,
        messages: [{ type: "text", text }],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`LINE Messaging API ${response.status}: ${body}`);
    }
  }
}
