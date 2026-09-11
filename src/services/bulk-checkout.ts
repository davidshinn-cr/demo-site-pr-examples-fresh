/** Validates a complete batch before an atomic group of invoice writes. */
import type { Invoice, PurchaseRequest, User } from "../contracts/model.ts";
import { isRecord } from "../contracts/model.ts";
import type { Store } from "../db/store.ts";
import { HttpError } from "../errors.ts";
import { checkout, parsePurchase } from "./checkout.ts";

export function parseBatch(value: unknown): PurchaseRequest[] {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    value.items.length < 1 ||
    value.items.length > 10
  )
    throw new HttpError(400, "Submit 1–10 line items.");
  return value.items.map(parsePurchase);
}
export function bulkCheckout(
  store: Store,
  user: User,
  items: readonly PurchaseRequest[],
): Invoice[] {
  for (const item of items)
    if (!store.product(item.productId))
      throw new HttpError(404, "Product not found.");
  store.db.exec("BEGIN IMMEDIATE");
  try {
    const invoices = items.map((item) => checkout(store, user, item));
    store.db.exec("COMMIT");
    return invoices;
  } catch (error: unknown) {
    store.db.exec("ROLLBACK");
    throw error;
  }
}
