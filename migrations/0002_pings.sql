CREATE TABLE pings (
  id TEXT PRIMARY KEY,
  monitor_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('start', 'success', 'fail')),
  at INTEGER NOT NULL,
  FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE
);

CREATE INDEX idx_pings_monitor_at ON pings(monitor_id, at DESC);
