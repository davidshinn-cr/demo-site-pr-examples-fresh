/** Client presentation for promotional quote responses. */
import { isCents, isCount, isRecord } from "../contracts/model.ts";
export function promotionSummary(value: unknown): string {
  if (
    !isRecord(value) ||
    !isCents(value.subtotalCents) ||
    !isCount(value.itemCount) ||
    typeof value.total !== "number" ||
    !Number.isFinite(value.total) ||
    value.total < 0 ||
    typeof value.discountPercent !== "number"
  )
    throw new Error("Invalid promotional quote.");
  return `Amount due: ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value.total)} · ${value.discountPercent}% bulk discount`;
}
