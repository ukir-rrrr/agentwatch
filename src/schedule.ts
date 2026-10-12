import type { Monitor, RuntimeState } from "./types";

const MINUTE = 60_000;

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const WEEKDAYS: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

export type ParsedCron = {
  minute: boolean[];
  hour: boolean[];
  dayOfMonth: boolean[];
  month: boolean[];
  dayOfWeek: boolean[];
  domIsStar: boolean;
  dowIsStar: boolean;
};

export function floorToUtcMinute(ms: number): number {
  return Math.floor(ms / MINUTE) * MINUTE;
}

export function parseCron(expr: string): ParsedCron {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error("cron は 5 フィールド (分 時 日 月 曜日) で指定してください");
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  return {
    minute: parseField(minute, 0, 59),
    hour: parseField(hour, 0, 23),
    dayOfMonth: parseField(dayOfMonth, 1, 31),
    month: parseField(month, 1, 12, MONTHS),
    dayOfWeek: parseDow(dayOfWeek),
    domIsStar: dayOfMonth === "*" || dayOfMonth === "?",
    dowIsStar: dayOfWeek === "*" || dayOfWeek === "?",
  };
}

export function previousCronOccurrence(expr: string, now: number): number | null {
  const parsed = parseCron(expr);
  let cursor = new Date(floorToUtcMinute(now));

  for (let day = 0; day < 366 * 2; day++) {
    if (matchesDate(parsed, cursor)) {
      const startHour = day === 0 ? cursor.getUTCHours() : 23;
      const startMinute = day === 0 ? cursor.getUTCMinutes() : 59;
      const hit = previousTimeOnDay(parsed, cursor, startHour, startMinute);
      if (hit != null) return hit;
    }
    cursor = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate() - 1, 23, 59, 0, 0),
    );
  }
  return null;
}

export function lastExpectedStart(monitor: Monitor, state: RuntimeState, now: number): number | null {
  if (monitor.scheduleKind === "cron") {
    if (!monitor.cronExpr) return null;
    const previous = previousCronOccurrence(monitor.cronExpr, now);
    if (previous == null || previous < floorToUtcMinute(monitor.createdAt)) {
      return null;
    }
    return previous;
  }

  const periodMs = (monitor.periodSeconds ?? 0) * 1000;
  if (periodMs <= 0) return null;

  const lastCycle = maxTs(
    state.lastSuccessAt,
    state.lastFailAt,
    state.lastAlertKind === "unfinished" ? state.lastAlertRunStartedAt : null,
  );
  const expected = lastCycle != null ? lastCycle + periodMs : monitor.createdAt + periodMs;
  return expected <= now ? expected : null;
}

export function formatSchedule(monitor: Pick<Monitor, "scheduleKind" | "cronExpr" | "periodSeconds">): string {
  if (monitor.scheduleKind === "cron") {
    return monitor.cronExpr ?? "(cron)";
  }
  const seconds = monitor.periodSeconds ?? 0;
  if (seconds % 3600 === 0) return `every ${seconds / 3600}h`;
  if (seconds % 60 === 0) return `every ${seconds / 60}m`;
  return `every ${seconds}s`;
}

function previousTimeOnDay(
  parsed: ParsedCron,
  day: Date,
  startHour: number,
  startMinute: number,
): number | null {
  for (let hour = startHour; hour >= 0; hour--) {
    if (!parsed.hour[hour]) continue;
    const minuteStart = hour === startHour ? startMinute : 59;
    for (let minute = minuteStart; minute >= 0; minute--) {
      if (!parsed.minute[minute]) continue;
      return Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, minute, 0, 0);
    }
  }
  return null;
}

function matchesDate(parsed: ParsedCron, date: Date): boolean {
  if (!parsed.month[date.getUTCMonth() + 1]) return false;
  const dom = parsed.dayOfMonth[date.getUTCDate()];
  const dow = parsed.dayOfWeek[date.getUTCDay()];
  if (parsed.domIsStar && parsed.dowIsStar) return true;
  if (!parsed.domIsStar && !parsed.dowIsStar) return Boolean(dom || dow);
  if (!parsed.domIsStar) return Boolean(dom);
  return Boolean(dow);
}

function parseDow(expr: string): boolean[] {
  const allowed = parseField(expr, 0, 7, WEEKDAYS);
  // 7 === Sunday in classic cron
  if (allowed[7]) allowed[0] = true;
  return allowed;
}

function parseField(
  expr: string,
  min: number,
  max: number,
  names: Record<string, number> = {},
): boolean[] {
  const allowed = Array.from({ length: max + 1 }, () => false);
  if (expr === "*" || expr === "?") {
    for (let i = min; i <= max; i++) allowed[i] = true;
    return allowed;
  }

  for (const item of expr.split(",")) {
    const [rangePart, stepPart] = item.split("/");
    const step = stepPart ? parseInt(stepPart, 10) : 1;
    if (!Number.isFinite(step) || step < 1) {
      throw new Error(`不正な cron ステップ: ${item}`);
    }

    let start = min;
    let end = max;
    if (rangePart !== "*") {
      const bounds = rangePart.split("-");
      start = parseNameOrNumber(bounds[0], names);
      end = bounds.length > 1 ? parseNameOrNumber(bounds[1], names) : start;
    }
    if (start < min || end > max || start > end) {
      throw new Error(`不正な cron 範囲: ${item}`);
    }
    for (let value = start; value <= end; value += step) {
      allowed[value] = true;
    }
  }
  return allowed;
}

function parseNameOrNumber(raw: string, names: Record<string, number>): number {
  const named = names[raw.toLowerCase()];
  if (named != null) return named;
  const value = parseInt(raw, 10);
  if (!Number.isFinite(value)) {
    throw new Error(`不正な cron 値: ${raw}`);
  }
  return value;
}

function maxTs(...values: Array<number | null | undefined>): number | null {
  let max: number | null = null;
  for (const value of values) {
    if (value == null) continue;
    if (max == null || value > max) max = value;
  }
  return max;
}
