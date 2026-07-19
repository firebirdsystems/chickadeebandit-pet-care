/**
 * Pure business logic for the Pet Care app.
 * No DOM, no fetch — importable in both browser and test environments.
 */

export function formatDuration(totalMinutes) {
  const m = Math.round(Math.abs(totalMinutes));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

// Date inputs carry a calendar date with no timezone. Round-tripping one through
// `new Date("2026-07-01")` parses it as UTC midnight, which reads back as the
// previous day west of UTC — so convert against the local calendar instead.
export function localDateToISO(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

export function isoToLocalDateInput(iso) {
  if (!iso) return "";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  const pad = n => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export function statusColor(pct) {
  const c = Math.min(1, Math.max(0, pct));
  function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
  let r, g, b;
  if (c < 0.5) {
    const t = c / 0.5;
    [r, g, b] = [lerp(22, 217, t), lerp(163, 119, t), lerp(74, 6, t)];
  } else {
    const t = (c - 0.5) / 0.5;
    [r, g, b] = [lerp(217, 220, t), lerp(119, 38, t), lerp(6, 38, t)];
  }
  return `rgb(${r},${g},${b})`;
}

export function activityStatusInterval(activity, log, members, now = new Date()) {
  const hours = activity.interval_hours ?? 24;
  if (!log) return { pct: 2, label: "Never done", lastBy: null };

  const lastDone = new Date(log.done_at);
  const elapsedH = (now - lastDone) / 3600000;
  const pct      = elapsedH / hours;
  const nextDue  = new Date(lastDone.getTime() + hours * 3600000);
  const diffMin  = (nextDue - now) / 60000;
  const label    = pct >= 1
    ? `Overdue by ${formatDuration(-diffMin)}`
    : `Due in ${formatDuration(diffMin)}`;
  const member   = members.find(m => m.id === log.done_by) ?? null;
  const agoMin   = (now - lastDone) / 60000;
  return { pct, label, lastBy: { member, agoMin } };
}

export function activityStatusTimes(activity, log, now = new Date()) {
  const times = activity.times ?? [];
  if (!times.length) return { pct: 0, label: "No times configured", lastBy: null };

  const todayTimes = times
    .map(t => {
      const [h, m] = t.split(":").map(Number);
      const d = new Date(now);
      d.setHours(h, m, 0, 0);
      return d;
    })
    .sort((a, b) => a - b);

  const pastTimes   = todayTimes.filter(t => t <= now);
  const futureTimes = todayTimes.filter(t => t > now);

  const windowStart = pastTimes.length > 0
    ? pastTimes[pastTimes.length - 1]
    : new Date(todayTimes[todayTimes.length - 1].getTime() - 86400000);

  const doneSinceWindow = log && new Date(log.done_at) >= windowStart;

  if (doneSinceWindow) {
    const nextLabel = futureTimes.length > 0
      ? `Next at ${futureTimes[0].toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
      : `Next at ${todayTimes[0].toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} tomorrow`;
    return { pct: 0, label: nextLabel };
  }

  if (!log) return { pct: 2, label: `Scheduled ${windowStart.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`, lastBy: null };

  const minutesPast = (now - windowStart) / 60000;
  const pct   = Math.min(2, minutesPast / 30);
  const label = minutesPast < 1
    ? `Due now (${windowStart.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })})`
    : `Overdue by ${formatDuration(minutesPast)}`;
  return { pct, label };
}
