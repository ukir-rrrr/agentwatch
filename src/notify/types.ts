import type { Alert, Monitor } from "../types";

export type Notification = {
  monitor: Monitor;
  alert: Alert;
};

export interface Notifier {
  readonly channel: string;
  send(notification: Notification): Promise<void>;
}
