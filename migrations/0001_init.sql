CREATE TABLE monitors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  schedule_kind TEXT NOT NULL CHECK (schedule_kind IN ('cron', 'period')),
  cron_expr TEXT,
  period_seconds INTEGER,
  grace_seconds INTEGER NOT NULL,
  max_runtime_seconds INTEGER NOT NULL,
  ping_token TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE monitor_state (
  monitor_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'unknown',
  last_start_at INTEGER,
  last_success_at INTEGER,
  last_fail_at INTEGER,
  last_expected_at INTEGER,
  current_run_started_at INTEGER,
  alerting_kind TEXT,
  last_alert_kind TEXT,
  last_alert_at INTEGER,
  last_alert_slot INTEGER,
  last_alert_run_started_at INTEGER,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE
);

CREATE INDEX idx_monitors_ping_token ON monitors(ping_token);
CREATE INDEX idx_monitors_enabled ON monitors(enabled);
