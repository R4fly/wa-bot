/** Parsed five field cron expression. */
export interface CronFields {
  readonly minute: readonly number[];
  readonly hour: readonly number[];
  readonly dayOfMonth: readonly number[];
  readonly month: readonly number[];
  readonly dayOfWeek: readonly number[];
}

function parseField(field: string, min: number, max: number): number[] | null {
  const out = new Set<number>();
  for (const part of field.split(",")) {
    const trimmed = part.trim();
    let step = 1;
    let range = trimmed;
    const slash = trimmed.indexOf("/");
    if (slash !== -1) {
      step = Number(trimmed.slice(slash + 1));
      range = trimmed.slice(0, slash);
      if (!Number.isInteger(step) || step < 1) {
        return null;
      }
    }
    if (range === "*") {
      for (let value = min; value <= max; value += step) {
        out.add(value);
      }
      continue;
    }
    const dash = range.indexOf("-");
    if (dash !== -1) {
      const a = Number(range.slice(0, dash));
      const b = Number(range.slice(dash + 1));
      if (!Number.isInteger(a) || !Number.isInteger(b) || a < min || b > max || a > b) {
        return null;
      }
      for (let value = a; value <= b; value += step) {
        out.add(value);
      }
      continue;
    }
    const single = Number(range);
    if (!Number.isInteger(single) || single < min || single > max) {
      return null;
    }
    out.add(single);
  }
  return [...out].sort((a, b) => a - b);
}

/** Parses a five field cron expression. Returns null when malformed. */
export function parseCron(expr: string): CronFields | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    return null;
  }
  const minute = parseField(parts[0] as string, 0, 59);
  const hour = parseField(parts[1] as string, 0, 23);
  const dayOfMonth = parseField(parts[2] as string, 1, 31);
  const month = parseField(parts[3] as string, 1, 12);
  const dayOfWeek = parseField(parts[4] as string, 0, 6);
  if (minute === null || hour === null || dayOfMonth === null || month === null || dayOfWeek === null) {
    return null;
  }
  return { minute, hour, dayOfMonth, month, dayOfWeek };
}

const WEEKDAY: Readonly<Record<string, number>> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Reports whether a date matches cron fields in one time zone. */
export function cronMatches(fields: CronFields, date: Date, timeZone: string): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  let minute = -1;
  let hour = -1;
  let day = -1;
  let month = -1;
  let weekday = -1;
  for (const part of parts) {
    if (part.type === "minute") {
      minute = Number(part.value);
    } else if (part.type === "hour") {
      hour = Number(part.value);
    } else if (part.type === "day") {
      day = Number(part.value);
    } else if (part.type === "month") {
      month = Number(part.value);
    } else if (part.type === "weekday") {
      weekday = WEEKDAY[part.value] ?? -1;
    }
  }
  return (
    fields.minute.includes(minute) &&
    fields.hour.includes(hour) &&
    fields.dayOfMonth.includes(day) &&
    fields.month.includes(month) &&
    fields.dayOfWeek.includes(weekday)
  );
}
