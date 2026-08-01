/**
 * Deleting a pet used to be three sequential /api/db calls with the parent
 * going first, so a failure after the first left activities and logs orphaned
 * under a pet that no longer exists — invisible to the UI and to the
 * recurring_due digest, and unreachable by any later delete. manifest
 * delete_cascades now removes them inside the parent's transactional batch.
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { describe, it, expect } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(__dirname, "../manifest.json"), "utf-8"));
const schema = readFileSync(join(__dirname, "../migrations/001_init.sql"), "utf-8");
const client = readFileSync(join(__dirname, "../src/index.html"), "utf-8");

describe("delete_cascades", () => {
  it("declares the pet's and the activity's children", () => {
    expect(manifest.delete_cascades).toEqual({
      pets: [
        { table: "activities", foreign_key: "pet_id" },
        { table: "logs", foreign_key: "pet_id" },
      ],
      activities: [{ table: "logs", foreign_key: "activity_id" }],
    });
  });

  it("every declared table and foreign key exists in the migrations", () => {
    for (const [parent, dependents] of Object.entries(manifest.delete_cascades)) {
      expect(schema).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS app_pet_care__${parent}\\s*\\(`));
      for (const dep of dependents) {
        expect(schema).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS app_pet_care__${dep.table}\\s*\\(`));
        expect(schema).toMatch(new RegExp(`\\b${dep.foreign_key}\\b`));
      }
    }
  });

  it("the client no longer deletes the children itself", () => {
    expect(client).not.toMatch(/DELETE FROM app_pet_care__activities WHERE pet_id/);
    expect(client).not.toMatch(/DELETE FROM app_pet_care__logs WHERE pet_id/);
    expect(client).not.toMatch(/DELETE FROM app_pet_care__logs WHERE activity_id = \? *`/);
    // The parent deletes remain, one statement each.
    expect(client).toMatch(/DELETE FROM app_pet_care__pets WHERE id = \?/);
    expect(client).toMatch(/DELETE FROM app_pet_care__activities WHERE id = \?/);
  });
});
