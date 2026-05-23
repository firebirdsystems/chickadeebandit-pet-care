import { describe, it, expect } from "vitest";
import { formatDuration, statusColor, activityStatusInterval, activityStatusTimes } from "../src/logic.js";

// ── formatDuration ────────────────────────────────────────────────────────────

describe("formatDuration", () => {
  it("formats minutes under one hour", () => {
    expect(formatDuration(30)).toBe("30m");
    expect(formatDuration(0)).toBe("0m");
  });

  it("formats whole hours", () => {
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(120)).toBe("2h");
  });

  it("formats hours and remainder", () => {
    expect(formatDuration(90)).toBe("1h 30m");
    expect(formatDuration(125)).toBe("2h 5m");
  });

  it("rounds fractional minutes", () => {
    expect(formatDuration(30.4)).toBe("30m");
    expect(formatDuration(30.6)).toBe("31m");
  });

  it("uses absolute value for negatives", () => {
    expect(formatDuration(-30)).toBe("30m");
  });
});

// ── statusColor ───────────────────────────────────────────────────────────────

describe("statusColor", () => {
  it("returns green for 0", () => {
    expect(statusColor(0)).toMatch(/^rgb\(22,\s*163,\s*74\)$/);
  });

  it("returns red for 1", () => {
    expect(statusColor(1)).toMatch(/^rgb\(220,\s*38,\s*38\)$/);
  });

  it("clamps out-of-range values", () => {
    expect(statusColor(-1)).toBe(statusColor(0));
    expect(statusColor(5)).toBe(statusColor(1));
  });
});

// ── activityStatusInterval ────────────────────────────────────────────────────

describe("activityStatusInterval", () => {
  const activity = { id: "a1", interval_hours: 24, schedule_type: "interval" };
  const member   = { id: "u1", name: "Alex" };
  const members  = [member];

  it("returns never-done when log is null", () => {
    const s = activityStatusInterval(activity, null, members);
    expect(s.label).toBe("Never done");
    expect(s.pct).toBe(2);
  });

  it("returns overdue when past the interval", () => {
    const log = { done_by: "u1", done_at: new Date(Date.now() - 30 * 3600000).toISOString() };
    const s = activityStatusInterval(activity, log, members);
    expect(s.pct).toBeGreaterThan(1);
    expect(s.label).toMatch(/Overdue/);
  });

  it("returns due-in when within the interval", () => {
    const log = { done_by: "u1", done_at: new Date(Date.now() - 1 * 3600000).toISOString() };
    const s = activityStatusInterval(activity, log, members);
    expect(s.pct).toBeLessThan(1);
    expect(s.label).toMatch(/Due in/);
  });

  it("sets lastBy.member correctly", () => {
    const log = { done_by: "u1", done_at: new Date(Date.now() - 1 * 3600000).toISOString() };
    const s = activityStatusInterval(activity, log, members);
    expect(s.lastBy.member.name).toBe("Alex");
  });

  it("defaults interval_hours to 24", () => {
    const actNoInterval = { id: "a2", schedule_type: "interval" };
    const log = { done_by: "u1", done_at: new Date(Date.now() - 12 * 3600000).toISOString() };
    const s = activityStatusInterval(actNoInterval, log, members);
    expect(s.pct).toBeCloseTo(0.5, 1);
  });
});

// ── activityStatusTimes ───────────────────────────────────────────────────────

describe("activityStatusTimes", () => {
  it("returns 'No times configured' when times array is empty", () => {
    const s = activityStatusTimes({ times: [] }, null);
    expect(s.label).toBe("No times configured");
  });

  it("returns done status when log is after the last window start", () => {
    const now = new Date("2025-06-15T14:00:00");
    const activity = { times: ["08:00", "12:00"] }; // window start = 12:00
    const log = { done_at: new Date("2025-06-15T12:30:00").toISOString() };
    const s = activityStatusTimes(activity, log, now);
    expect(s.pct).toBe(0);
    expect(s.label).toMatch(/Next at/);
  });

  it("returns overdue when past the window and log is before window start", () => {
    const now = new Date("2025-06-15T14:00:00");
    const activity = { times: ["08:00", "12:00"] };
    const log = { done_at: new Date("2025-06-15T07:00:00").toISOString() };
    const s = activityStatusTimes(activity, log, now);
    expect(s.label).toMatch(/Overdue/);
    expect(s.pct).toBeGreaterThan(0);
  });
});
