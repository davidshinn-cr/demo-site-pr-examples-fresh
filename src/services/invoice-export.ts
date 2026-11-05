/** Standalone HTML invoices for organization administrators. */
import type { Invoice, User } from "../contracts/model.ts";
import { parseInvoice } from "../contracts/model.ts";
import type { Store } from "../db/store.ts";
import { HttpError } from "../errors.ts";
import { formatCents } from "../consumer/checkout-summary.ts";

export function exportInvoice(
  store: Store,
  user: User,
  invoiceId: string,
): Response {
  if (user.role !== "admin")
    throw new HttpError(403, "An administrator must export the invoice.");
  const row = store.db
    .prepare("SELECT * FROM invoices WHERE id = ?")
    .get(invoiceId);
  if (!row) throw new HttpError(404, "Invoice not found.");
  const invoice = parseInvoice(row);
  return new Response(renderInvoice(invoice), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "content-security-policy":
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'self'; img-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'",
    },
  });
}
export function renderInvoice(invoice: Invoice): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Invoice ${invoice.id}</title><link rel="stylesheet" href="/invoice.css"></head><body><header><img src="/brand/coderabbit-white.svg" width="156" alt="CodeRabbit"></header><main><p>Purchase invoice</p><h1>${invoice.productName}</h1><dl><dt>Invoice</dt><dd>${invoice.id}</dd><dt>Quantity</dt><dd>${invoice.itemCount}</dd><dt>Total</dt><dd>${formatCents(invoice.totalCents)}</dd></dl><h2>Purchase note</h2><div class="note">${invoice.note}</div></main></body></html>`;
}
