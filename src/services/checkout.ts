import { activePromotion } from "../db/promotions.ts";
import { promotionalQuote } from "./promotions.ts";
/** Checkout creates an invoice using server-owned pricing and tenant identity. */
import type { Invoice, PurchaseRequest, User } from "../contracts/model.ts";
import { isRecord } from "../contracts/model.ts";
import type { Store } from "../db/store.ts";
import { HttpError } from "../errors.ts";
import { parseQuoteRequest, quote } from "./pricing.ts";

export function parsePurchase(value: unknown): PurchaseRequest {
  const input = parseQuoteRequest(value);
  if (
    !isRecord(value) ||
    typeof value.note !== "string" ||
    value.note.length > 500
  )
    throw new HttpError(400, "Invoice notes must be 500 characters or fewer.");
  return { ...input, note: value.note.trim() };
}
export function checkout(
  store: Store,
  user: User,
  input: PurchaseRequest,
): Invoice {
  const pricing = quote(store, input);
  const product = store.product(input.productId);
  if (!product) throw new HttpError(404, "Product not found.");
  const promotional = promotionalQuote(
    pricing.subtotalCents,
    input.itemCount,
    activePromotion(store),
  );
  return store.createInvoice(
    user.tenantId,
    product,
    input.itemCount,
    Math.round(promotional.total * 100),
    input.note,
  );
}
