/** HTTP DTOs: money is integer cents and identifiers are opaque strings. */
export interface User {
  readonly id: string;
  readonly name: string;
  readonly tenantId: string;
  readonly organization: string;
  readonly role: "buyer" | "admin";
}
export interface Product {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly unitCents: number;
}
export interface QuoteRequest {
  readonly productId: string;
  readonly itemCount: number;
}
export interface PriceQuote {
  readonly subtotalCents: number;
  readonly totalCents: number;
  readonly itemCount: number;
}
export interface Invoice {
  readonly id: string;
  readonly tenantId: string;
  readonly productName: string;
  readonly itemCount: number;
  readonly totalCents: number;
  readonly note: string;
  readonly createdAt: string;
}
export interface PurchaseRequest extends QuoteRequest {
  readonly note: string;
}

/** Fail closed when an API response does not match the pricing contract. */
export function parseQuote(value: unknown): PriceQuote {
  if (
    !isRecord(value) ||
    !isCents(value.subtotalCents) ||
    !isCents(value.totalCents) ||
    !isCount(value.itemCount)
  )
    throw new Error("Invalid pricing response");
  return {
    subtotalCents: value.subtotalCents,
    totalCents: value.totalCents,
    itemCount: value.itemCount,
  };
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function isCents(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
export function isCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 100
  );
}
export function parseUser(value: unknown): User {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.tenantId !== "string" ||
    typeof value.organization !== "string" ||
    (value.role !== "buyer" && value.role !== "admin")
  )
    throw new Error("Invalid session response");
  return {
    id: value.id,
    name: value.name,
    tenantId: value.tenantId,
    organization: value.organization,
    role: value.role,
  };
}
export function parseProduct(value: unknown): Product {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.description !== "string" ||
    !isCents(value.unitCents)
  )
    throw new Error("Invalid product response");
  return {
    id: value.id,
    name: value.name,
    description: value.description,
    unitCents: value.unitCents,
  };
}
export function parseInvoice(value: unknown): Invoice {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.tenantId !== "string" ||
    typeof value.productName !== "string" ||
    !isCount(value.itemCount) ||
    !isCents(value.totalCents) ||
    typeof value.note !== "string" ||
    typeof value.createdAt !== "string"
  )
    throw new Error("Invalid invoice response");
  return {
    id: value.id,
    tenantId: value.tenantId,
    productName: value.productName,
    itemCount: value.itemCount,
    totalCents: value.totalCents,
    note: value.note,
    createdAt: value.createdAt,
  };
}
export function parseList<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new Error("Invalid list response");
  return value.map(parse);
}
