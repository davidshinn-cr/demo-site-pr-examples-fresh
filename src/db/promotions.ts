/** Adds the active promotion catalog without changing existing invoice records. */
import type { Store } from "./store.ts";
import { isRecord } from "../contracts/model.ts";
import type { Promotion } from "../services/promotions.ts";

export function migratePromotions(store: Store): void {
  store.db.exec(`CREATE TABLE IF NOT EXISTS promotions (
    code TEXT PRIMARY KEY,
    minimumItems INTEGER NOT NULL CHECK(minimumItems BETWEEN 1 AND 100),
    percentOff INTEGER NOT NULL CHECK(percentOff BETWEEN 0 AND 100),
    expiresAt INTEGER NOT NULL
  );
  INSERT OR IGNORE INTO promotions VALUES ('TEAM10', 10, 10, 4102444800000);`);
}
export function activePromotion(store: Store): Promotion {
  const row = store.db
    .prepare(
      "SELECT minimumItems, percentOff, expiresAt FROM promotions WHERE code = ?",
    )
    .get("TEAM10");
  if (
    !isRecord(row) ||
    typeof row.minimumItems !== "number" ||
    typeof row.percentOff !== "number" ||
    typeof row.expiresAt !== "number"
  )
    throw new Error("Promotion unavailable");
  return {
    minimumItems: row.minimumItems,
    percentOff: row.percentOff,
    expiresAt: row.expiresAt,
  };
}
