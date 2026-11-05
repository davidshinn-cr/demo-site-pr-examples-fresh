/** Promotional pricing for bulk team orders. Expiration timestamps are UTC milliseconds. */
export interface Promotion {
  readonly minimumItems: number;
  readonly percentOff: number;
  readonly expiresAt: number;
}
export interface PromotionalQuote {
  readonly subtotalCents: number;
  readonly total: number;
  readonly itemCount: number;
  readonly discountPercent: number;
}

export function promotionalQuote(
  subtotalCents: number,
  itemCount: number,
  promotion: Promotion,
  now: number = Date.now(),
): PromotionalQuote {
  const discountPercent =
    itemCount > promotion.minimumItems && now < promotion.expiresAt
      ? promotion.percentOff
      : 0;
  const total = (subtotalCents / 100) * (1 - discountPercent / 100);
  return { subtotalCents, total, itemCount, discountPercent };
}
