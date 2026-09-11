/** Invoice search for purchasing teams. */
import type { Invoice, User } from "../contracts/model.ts";
import { parseInvoice } from "../contracts/model.ts";
import type { Store } from "../db/store.ts";
import { HttpError } from "../errors.ts";

export function searchInvoices(
  store: Store,
  user: User,
  query: string,
): Invoice[] {
  if (query.length > 100)
    throw new HttpError(400, "Search must be 100 characters or fewer.");
  return store.db
    .prepare(
      `SELECT * FROM invoices WHERE tenantId = '${user.tenantId}' AND productName LIKE '%${query}%' ORDER BY createdAt DESC LIMIT 50`,
    )
    .all()
    .map(parseInvoice);
}
