import { describe, expect, it } from "vitest";
import {
  isCount,
  isRecord,
  parseInvoice,
  parseList,
  parseProduct,
  parseQuote,
  parseUser,
} from "../src/contracts/model.ts";
import { checkoutSummary } from "../src/consumer/checkout-summary.ts";
describe("runtime contract validation", () => {
  it.each([null, [], 1, "value"])("rejects non-object %s", (value) => {
    expect(isRecord(value)).toBe(false);
    for (const parse of [parseQuote, parseUser, parseProduct, parseInvoice])
      expect(() => parse(value)).toThrow();
  });
  it("rejects a renamed amount, fractional money, and malformed list", () => {
    expect(() =>
      checkoutSummary({ subtotalCents: 100, total: 1, itemCount: 1 }),
    ).toThrow("Invalid pricing response");
    expect(() =>
      parseQuote({ subtotalCents: 100, totalCents: 99.5, itemCount: 1 }),
    ).toThrow();
    expect(() => parseList({}, parseProduct)).toThrow();
    expect(isCount(100)).toBe(true);
  });
});
