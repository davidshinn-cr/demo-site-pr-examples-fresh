/** An independent HTTP consumer demonstrates compatibility without another repo. */
import { parseQuote } from "../contracts/model.ts";

export function checkoutSummary(response: unknown): string {
  const quote = parseQuote(response);
  return `Amount due: ${formatCents(quote.totalCents)}`;
}
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
