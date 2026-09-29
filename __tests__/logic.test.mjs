import { describe, it, expect, vi } from "vitest";
import {
  formatDuration, statusColor, activityStatusInterval, activityStatusTimes, localDateToISO, isoToLocalDateInput,
  logAuthor, schedLabel, sitPetIds, sitIsOpen, sitTaskRows, sitTasksDrifted, sitTaskStatements, formatDay, sitDates,
  sitExpiryChoice, CARE_SNAPSHOT_STATEMENTS, parseCareSnapshot, refreshSitChecklists,
  lastDoneToSave, sitSyncBlocksShare, planSitLinkRevoke,
  SIT_MAX_TASKS,
} from "../src/logic.js";

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

// ── local date round-trip ─────────────────────────────────────────────────────

describe("localDateToISO / isoToLocalDateInput", () => {
  it("round-trips a date input back to the same calendar date", () => {
    for (const d of ["2026-07-01", "2026-01-15", "2026-12-31", "2026-03-08"]) {
      expect(isoToLocalDateInput(localDateToISO(d))).toBe(d);
    }
  });

  it("anchors the stored instant to local midnight, not UTC midnight", () => {
    const dt = new Date(localDateToISO("2026-07-01"));
    expect(dt.getFullYear()).toBe(2026);
    expect(dt.getMonth()).toBe(6);
    expect(dt.getDate()).toBe(1);
    expect(dt.getHours()).toBe(0);
  });

  it("reads a stored instant back as its local calendar date", () => {
    const dt = new Date(2026, 6, 1, 23, 30);
    expect(isoToLocalDateInput(dt.toISOString())).toBe("2026-07-01");
  });

  it("returns null/empty for blank or malformed values", () => {
    expect(localDateToISO("")).toBeNull();
    expect(localDateToISO(null)).toBeNull();
    expect(localDateToISO("not-a-date")).toBeNull();
    expect(isoToLocalDateInput("")).toBe("");
    expect(isoToLocalDateInput(null)).toBe("");
    expect(isoToLocalDateInput("not-a-date")).toBe("");
  });
});

// ── Sitter ticks ──────────────────────────────────────────────────────────────

describe("logAuthor", () => {
  const members = [{ id: "u1", name: "Alex" }];

  it("names a member by their id", () => {
    expect(logAuthor({ done_by: "u1" }, members)).toMatchObject({ member: members[0], name: "Alex", sitter: false });
  });

  it("names a sitter's tick by the name they typed, not as a member", () => {
    expect(logAuthor({ done_by: "sitter", sitter_name: "Sam" }, members)).toEqual({ member: null, name: "Sam", sitter: true });
  });

  it("falls back to 'Sitter' for a sitter with no name, and 'Someone' for an unknown member", () => {
    expect(logAuthor({ done_by: "sitter", sitter_name: "" }, members).name).toBe("Sitter");
    expect(logAuthor({ done_by: "gone" }, members).name).toBe("Someone");
  });

  it("reaches activityStatusInterval's lastBy", () => {
    const log = { done_by: "sitter", sitter_name: "Sam", done_at: new Date(Date.now() - 3600000).toISOString() };
    const s = activityStatusInterval({ interval_hours: 24 }, log, members);
    expect(s.lastBy.name).toBe("Sam");
    expect(s.lastBy.member).toBeNull();
  });
});

describe("schedLabel", () => {
  it("says the interval or the times", () => {
    expect(schedLabel({ schedule_type: "interval", interval_hours: 12 })).toBe("Every 12h");
    expect(schedLabel({ schedule_type: "interval", interval_hours: null })).toBe("Every 24h");
    expect(schedLabel({ schedule_type: "times", times: ["08:00", "18:00"] })).toBe("08:00, 18:00");
  });
});

// ── Sits ──────────────────────────────────────────────────────────────────────

describe("sitPetIds", () => {
  it("reads the stored array and tolerates junk", () => {
    expect(sitPetIds({ pet_ids: '["p1","p2"]' })).toEqual(["p1", "p2"]);
    expect(sitPetIds({ pet_ids: "not json" })).toEqual([]);
    expect(sitPetIds({ pet_ids: '{"a":1}' })).toEqual([]);
    expect(sitPetIds({ pet_ids: '["p1",2]' })).toEqual(["p1"]);
    expect(sitPetIds({})).toEqual([]);
  });
});

describe("sitIsOpen", () => {
  it("is open until the end date passes, and never when archived", () => {
    expect(sitIsOpen({ archived: 0, ends_on: "2026-10-10" }, "2026-10-10")).toBe(true);
    expect(sitIsOpen({ archived: 0, ends_on: "2026-10-10" }, "2026-10-11")).toBe(false);
    expect(sitIsOpen({ archived: 0, ends_on: "" }, "2026-10-11")).toBe(true);
    expect(sitIsOpen({ archived: 1, ends_on: "" }, "2026-10-11")).toBe(false);
  });
});

describe("sitTaskRows", () => {
  const pets = [{ id: "p1", name: "Rex" }, { id: "p2", name: "Mochi" }, { id: "p3", name: "Kiwi" }];
  const activities = [
    { id: "a3", pet_id: "p2", name: "Feed", schedule_type: "interval", interval_hours: 24, sort_order: 0, created_at: "1" },
    { id: "a2", pet_id: "p1", name: "Walk", schedule_type: "interval", interval_hours: 12, sort_order: 1, created_at: "1" },
    { id: "a1", pet_id: "p1", name: "Breakfast", schedule_type: "times", times: ["08:00"], sort_order: 0, created_at: "1" },
    { id: "a4", pet_id: "p3", name: "Water", schedule_type: "interval", interval_hours: 24, sort_order: 0, created_at: "1" },
  ];

  it("lists the chosen pets' activities, pets in order, each pet's in its own order", () => {
    const rows = sitTaskRows({ pet_ids: '["p2","p1"]' }, pets, activities);
    expect(rows).toEqual([
      { activity_id: "a1", pet_id: "p1", label: "Rex · Breakfast", detail: "08:00", sort_order: 0 },
      { activity_id: "a2", pet_id: "p1", label: "Rex · Walk", detail: "Every 12h", sort_order: 1 },
      { activity_id: "a3", pet_id: "p2", label: "Mochi · Feed", detail: "Every 24h", sort_order: 2 },
    ]);
  });

  it("skips a chosen pet that no longer exists", () => {
    expect(sitTaskRows({ pet_ids: '["gone"]' }, pets, activities)).toEqual([]);
  });
});

describe("sitTasksDrifted", () => {
  const want = [
    { activity_id: "a1", pet_id: "p1", label: "Rex · Breakfast", detail: "08:00" },
    { activity_id: "a2", pet_id: "p1", label: "Rex · Walk", detail: "Every 12h" },
  ];
  const stored = want.map((r, i) => ({ ...r, id: `t${i}`, sit_id: "s1", sort_order: i }));

  it("is quiet when the stored checklist matches, whatever its row ids", () => {
    expect(sitTasksDrifted(stored, want)).toBe(false);
  });

  it("notices a rename, a schedule change, a reorder, an addition and a removal", () => {
    expect(sitTasksDrifted(stored, [{ ...want[0], label: "Rex · Brunch" }, want[1]])).toBe(true);
    expect(sitTasksDrifted(stored, [want[0], { ...want[1], detail: "Every 8h" }])).toBe(true);
    expect(sitTasksDrifted(stored, [want[1], want[0]])).toBe(true);
    expect(sitTasksDrifted(stored, [...want, { activity_id: "a3", pet_id: "p2", label: "x", detail: "" }])).toBe(true);
    expect(sitTasksDrifted(stored, [want[0]])).toBe(true);
  });
});

describe("sitTaskStatements", () => {
  const row = (i) => ({ activity_id: `a${i}`, pet_id: "p1", label: `T${i}`, detail: "", sort_order: i });
  let n = 0;
  const newId = () => `id-${n++}`;

  it("deletes the sit's rows, then inserts the new ones in order", () => {
    const [del, ins] = sitTaskStatements("s1", [row(0), row(1)], newId);
    expect(del).toEqual({ sql: "DELETE FROM app_pet_care__sit_tasks WHERE sit_id = ?", params: ["s1"] });
    expect(ins.params.filter((_, i) => i % 7 === 2)).toEqual(["a0", "a1"]);
    expect(ins.params.filter((_, i) => i % 7 === 1)).toEqual(["s1", "s1"]);
  });

  it("keeps every INSERT under D1's 100 bound parameters", () => {
    const statements = sitTaskStatements("s1", Array.from({ length: 30 }, (_, i) => row(i)), newId);
    expect(statements).toHaveLength(4); // delete + 14 + 14 + 2
    for (const st of statements.slice(1)) {
      expect(st.params.length).toBeLessThanOrEqual(100);
      expect((st.sql.match(/\?/g) ?? []).length).toBe(st.params.length);
    }
    const order = statements.slice(1).flatMap((st) => st.params.filter((_, i) => i % 7 === 2));
    expect(order).toEqual(Array.from({ length: 30 }, (_, i) => `a${i}`));
  });

  it("with no tasks, only clears the checklist", () => {
    expect(sitTaskStatements("s1", [], newId)).toHaveLength(1);
  });
});

describe("sit dates", () => {
  it("formats a range, either end alone, or nothing", () => {
    expect(sitDates({ starts_on: "2026-10-03", ends_on: "2026-10-10" })).toBe(`${formatDay("2026-10-03")} – ${formatDay("2026-10-10")}`);
    expect(sitDates({ starts_on: "2026-10-03", ends_on: "" })).toBe(`From ${formatDay("2026-10-03")}`);
    expect(sitDates({ starts_on: "", ends_on: "2026-10-10" })).toBe(`Until ${formatDay("2026-10-10")}`);
    expect(sitDates({ starts_on: "", ends_on: "" })).toBe("");
    expect(formatDay("junk")).toBe("");
  });
});

describe("sitExpiryChoice", () => {
  it("lasts through the day after the sit ends, counted from now", () => {
    const now = new Date(2026, 9, 10, 12, 0); // noon on the last day, local
    const choice = sitExpiryChoice({ ends_on: "2026-10-10" }, now);
    // To local midnight at the end of Oct 11: 12h + 24h.
    expect(choice.hours).toBe(36);
    expect(choice.label).toMatch(/^Until the day after the sit \(/);
  });

  it("rounds a part hour up rather than cutting the handover day short", () => {
    const now = new Date(2026, 9, 11, 22, 30);
    expect(sitExpiryChoice({ ends_on: "2026-10-10" }, now).hours).toBe(2);
  });

  it("is null with no end date, or once that moment has passed", () => {
    expect(sitExpiryChoice({ ends_on: "" }, new Date(2026, 9, 1))).toBeNull();
    expect(sitExpiryChoice({ ends_on: "2026-10-10" }, new Date(2026, 9, 12, 0, 0))).toBeNull();
    expect(sitExpiryChoice(undefined)).toBeNull();
  });
});

// ── Keeping a sit's checklist current ─────────────────────────────────────────

describe("parseCareSnapshot", () => {
  const ok = [{ rows: [{ id: "p1" }] }, { rows: [{ id: "a1", times: '["08:00"]' }] }, { rows: [] }, { rows: [] }];

  it("names the four reads and parses activity times", () => {
    const snap = parseCareSnapshot(ok);
    expect(snap.pets).toEqual([{ id: "p1" }]);
    expect(snap.activities[0].times).toEqual(["08:00"]);
    expect(snap.sits).toEqual([]);
    expect(snap.tasks).toEqual([]);
  });

  it("throws on any missing read rather than calling it an empty table", () => {
    expect(() => parseCareSnapshot([])).toThrow();
    expect(() => parseCareSnapshot(undefined)).toThrow();
    expect(() => parseCareSnapshot(ok.slice(0, 3))).toThrow();
    expect(() => parseCareSnapshot([{ error: "boom" }, ...ok.slice(1)])).toThrow();
    expect(() => parseCareSnapshot([ok[0], { rows: null }, ok[2], ok[3]])).toThrow();
  });

  it("reads every table a checklist is built from, in one batch", () => {
    expect(CARE_SNAPSHOT_STATEMENTS.map(st => st.sql.match(/FROM (\w+)/)[1])).toEqual([
      "app_pet_care__pets", "app_pet_care__activities", "app_pet_care__sits", "app_pet_care__sit_tasks",
    ]);
  });
});

describe("refreshSitChecklists", () => {
  const TODAY = "2026-10-05";
  const pets = [{ id: "p1", name: "Rex" }];
  const feed = { id: "a1", pet_id: "p1", name: "Feed", schedule_type: "interval", interval_hours: 12, sort_order: 0, created_at: "1" };
  const meds = { id: "a2", pet_id: "p1", name: "Meds", schedule_type: "interval", interval_hours: 24, sort_order: 1, created_at: "1" };
  const sit = { id: "s1", pet_ids: '["p1"]', archived: 0, ends_on: "2026-10-10" };
  const stored = (acts) => sitTaskRows(sit, pets, acts).map((r, i) => ({ ...r, id: `t${i}`, sit_id: "s1" }));
  let n = 0;
  const newId = () => `n${n++}`;

  it("never writes when the read fails", async () => {
    const write = vi.fn();
    await expect(refreshSitChecklists({
      read: async () => { throw new Error("offline"); }, write, today: TODAY, newId,
    })).rejects.toThrow("offline");
    expect(write).not.toHaveBeenCalled();
  });

  it("builds from what it read, not what the caller had: another adult's new activity is added", async () => {
    const write = vi.fn(async () => {});
    const { changed } = await refreshSitChecklists({
      read: async () => ({ pets, activities: [feed, meds], sits: [sit], tasks: stored([feed]) }),
      write, today: TODAY, newId,
    });
    expect(changed).toBe(true);
    const [statements] = write.mock.calls[0];
    expect(statements[1].params.filter((_, i) => i % 7 === 2)).toEqual(["a1", "a2"]);
  });

  it("leaves a checklist that matches alone, and skips archived and ended sits", async () => {
    const write = vi.fn(async () => {});
    const { changed } = await refreshSitChecklists({
      read: async () => ({
        pets, activities: [feed, meds],
        sits: [sit, { ...sit, id: "s2", archived: 1 }, { ...sit, id: "s3", ends_on: "2026-10-01" }],
        tasks: stored([feed, meds]),
      }),
      write, today: TODAY, newId,
    });
    expect(changed).toBe(false);
    expect(write).not.toHaveBeenCalled();
  });

  it("a refused write skips that sit only, and the sits after it still refresh", async () => {
    const write = vi.fn(async (statements) => {
      if (statements[0].params[0] === "s1") throw new Error("too many statements");
    });
    const { changed, failed } = await refreshSitChecklists({
      read: async () => ({ pets, activities: [feed, meds], sits: [sit, { ...sit, id: "s2" }], tasks: stored([feed]) }),
      write, today: TODAY, newId,
    });
    expect(failed).toEqual(["s1"]);
    expect(changed).toBe(true);
    expect(write.mock.calls.map(([st]) => st[0].params[0])).toEqual(["s1", "s2"]);
  });
});

describe("lastDoneToSave", () => {
  it("leaves the logs alone when the prefilled date is saved unchanged", () => {
    // A rename would otherwise move the newest log to local midnight.
    expect(lastDoneToSave("2026-10-04", "2026-10-04")).toBeNull();
  });

  it("saves a changed date as local midnight", () => {
    expect(lastDoneToSave("2026-10-02", "2026-10-04")).toBe(localDateToISO("2026-10-02"));
  });

  it("saves a date set on a form that had none", () => {
    expect(lastDoneToSave("2026-10-02", "")).toBe(localDateToISO("2026-10-02"));
    expect(lastDoneToSave("2026-10-02", undefined)).toBe(localDateToISO("2026-10-02"));
  });

  it("treats a cleared field as leave alone", () => {
    expect(lastDoneToSave("", "2026-10-04")).toBeNull();
    expect(lastDoneToSave("", undefined)).toBeNull();
  });
});

describe("sitSyncBlocksShare", () => {
  it("allows sharing after a clean sync", () => {
    expect(sitSyncBlocksShare({ ok: true, failed: [] }, "s1")).toBe(false);
  });

  it("blocks when the read failed, for every sit", () => {
    expect(sitSyncBlocksShare({ ok: false, failed: [] }, "s1")).toBe(true);
  });

  it("blocks only the sit whose rewrite was refused", () => {
    const result = { ok: true, failed: ["s2"] };
    expect(sitSyncBlocksShare(result, "s2")).toBe(true);
    expect(sitSyncBlocksShare(result, "s1")).toBe(false);
  });

  it("blocks on a missing result rather than guessing", () => {
    expect(sitSyncBlocksShare(undefined, "s1")).toBe(true);
  });
});

describe("planSitLinkRevoke", () => {
  const members = [{ id: "m-me", name: "Ada" }, { id: "m-sam", name: "Sam" }];
  const links = [
    { id: "l1", createdBy: "m-me" },
    { id: "l2", createdBy: "m-sam" },
    { id: "l3", createdBy: "m-sam" },
    { id: "l4", createdBy: "m-gone" },
  ];

  it("offers a member only their own links, naming each other holder once", () => {
    const plan = planSitLinkRevoke(links, { meId: "m-me", isAdmin: false, members });
    expect(plan.mine.map(l => l.id)).toEqual(["l1"]);
    expect(plan.others.map(l => l.id)).toEqual(["l2", "l3", "l4"]);
    // A creator no longer on the roster is "another adult", not an id.
    expect(plan.holders).toEqual(["Sam", "another adult"]);
  });

  it("offers an admin every link", () => {
    const plan = planSitLinkRevoke(links, { meId: "m-me", isAdmin: true, members });
    expect(plan.mine.map(l => l.id)).toEqual(["l1", "l2", "l3", "l4"]);
    expect(plan.others).toEqual([]);
    expect(plan.holders).toEqual([]);
  });

  it("offers nothing when every link is someone else's", () => {
    const plan = planSitLinkRevoke(links.slice(1, 3), { meId: "m-me", isAdmin: false, members });
    expect(plan.mine).toEqual([]);
    expect(plan.holders).toEqual(["Sam"]);
  });

  it("never matches a link to a member with no id", () => {
    const plan = planSitLinkRevoke([{ id: "l9", createdBy: undefined }], { meId: undefined, isAdmin: false, members });
    expect(plan.mine).toEqual([]);
  });
});

describe("the sitter page's task limit", () => {
  const TODAY = "2026-10-05";
  const parents = [{ id: "p1", name: "One", location: "" }];
  const acts = (n) => Array.from({ length: n }, (_, i) => ({ id: `a${i}`, pet_id: "p1", name: `T${i}`, schedule_type: "interval", interval_hours: 24, sort_order: i, created_at: "1" }));
  const sit = (id) => ({ id, pet_ids: '["p1"]', archived: 0, ends_on: "" });
  let n = 0;
  const newId = () => `n${n++}`;

  it("matches the hub's cap on a sitter page's options", () => {
    // MAX_SHAREABLE_SELECT_OPTIONS in hub-contract; the hub's share-pet-care
    // exercise test pins the two together.
    expect(SIT_MAX_TASKS).toBe(100);
  });

  it("writes a checklist of exactly the limit", async () => {
    const write = vi.fn(async () => {});
    const { changed, failed, tooMany } = await refreshSitChecklists({
      read: async () => ({ pets: parents, activities: acts(SIT_MAX_TASKS), sits: [sit("s1")], tasks: [] }),
      write, today: TODAY, newId,
    });
    expect(changed).toBe(true);
    expect(failed).toEqual([]);
    expect(tooMany).toEqual({});
    const written = write.mock.calls[0][0].slice(1).flatMap(st => st.params.filter((_, i) => i % 7 === 2));
    expect(written).toHaveLength(SIT_MAX_TASKS);
  });

  it("leaves a sit past the limit on its last checklist, and names it, while other sits refresh", async () => {
    const write = vi.fn(async () => {});
    const stored = [{ id: "t0", sit_id: "s-big", activity_id: "a0", pet_id: "p1", label: "old", detail: "", sort_order: 0 }];
    const { changed, failed, tooMany } = await refreshSitChecklists({
      read: async () => ({
        pets: [...parents, { id: "p2", name: "Two", location: "" }],
        activities: [...acts(SIT_MAX_TASKS + 1), { ...acts(1)[0], id: "b0", pet_id: "p2" }],
        sits: [sit("s-big"), { id: "s-small", pet_ids: '["p2"]', archived: 0, ends_on: "" }],
        tasks: stored,
      }),
      write, today: TODAY, newId,
    });
    expect(tooMany).toEqual({ "s-big": SIT_MAX_TASKS + 1 });
    expect(failed).toEqual(["s-big"]);
    // Nothing is written for the big sit (its stored checklist stays); the small one refreshes.
    expect(write.mock.calls.map(([st]) => st[0].params[0])).toEqual(["s-small"]);
    expect(changed).toBe(true);
  });

  it("a sit past the limit blocks sharing", () => {
    expect(sitSyncBlocksShare({ ok: true, failed: ["s-big"], tooMany: { "s-big": 101 } }, "s-big")).toBe(true);
  });
});

