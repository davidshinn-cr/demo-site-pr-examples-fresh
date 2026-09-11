/** Prices originate from the server catalog; clients cannot choose the subtotal. */
import type { PriceQuote, QuoteRequest } from "../contracts/model.ts";
import { isCount, isRecord } from "../contracts/model.ts";
import type { Store } from "../db/store.ts";
import { HttpError } from "../errors.ts";

export function parseQuoteRequest(value: unknown): QuoteRequest {
  if (
    !isRecord(value) ||
    typeof value.productId !== "string" ||
    !isCount(value.itemCount)
  )
    throw new HttpError(400, "Choose a product and a quantity from 1 to 100.");
  return { productId: value.productId, itemCount: value.itemCount };
}
export function quote(store: Store, input: QuoteRequest): PriceQuote {
  const product = store.product(input.productId);
  if (!product) throw new HttpError(404, "Product not found.");
  const subtotalCents = product.unitCents * input.itemCount;
  return {
    subtotalCents,
    totalCents: subtotalCents,
    itemCount: input.itemCount,
  };
}
