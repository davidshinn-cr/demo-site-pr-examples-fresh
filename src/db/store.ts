/** SQLite persistence and tenant-scoped reads. Each process owns its connection. */
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import type { Invoice, Product, User } from "../contracts/model.ts";
import { parseInvoice, parseProduct } from "../contracts/model.ts";

export const DEMO_USERS: readonly User[] = [
  {
    id: "atlas-buyer",
    name: "Jordan Lee",
    tenantId: "atlas",
    organization: "Atlas Studio",
    role: "buyer",
  },
  {
    id: "atlas-admin",
    name: "Sam Rivera",
    tenantId: "atlas",
    organization: "Atlas Studio",
    role: "admin",
  },
  {
    id: "northstar-buyer",
    name: "Alex Chen",
    tenantId: "northstar",
    organization: "Northstar Labs",
    role: "buyer",
  },
];

export class Store {
  readonly db: DatabaseSync;
  constructor(path: string = ":memory:") {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, unitCents INTEGER NOT NULL CHECK(unitCents >= 0));
      CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, tenantId TEXT NOT NULL, productName TEXT NOT NULL, itemCount INTEGER NOT NULL CHECK(itemCount BETWEEN 1 AND 100), totalCents INTEGER NOT NULL CHECK(totalCents >= 0), note TEXT NOT NULL, createdAt TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS invoices_tenant ON invoices(tenantId);`);
    const product = this.db.prepare(
      "INSERT OR IGNORE INTO products VALUES (?, ?, ?, ?)",
    );
    product.run(
      "notebook",
      "Field notebook",
      "Lay-flat binding · dotted pages",
      1299,
    );
    product.run(
      "desk-kit",
      "Desk essentials",
      "Notebook, pen, and cable organizer",
      3499,
    );
    product.run(
      "travel-pack",
      "Travel pack",
      "Everyday carry for your next offsite",
      7999,
    );
    this.db
      .prepare("INSERT OR IGNORE INTO invoices VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(
        "inv-northstar",
        "northstar",
        "Desk essentials",
        2,
        6998,
        "Northstar internal purchase",
        "2026-09-01T10:00:00.000Z",
      );
    this.db
      .prepare("INSERT OR IGNORE INTO invoices VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(
        "inv-atlas",
        "atlas",
        "Field notebook",
        3,
        3897,
        "Welcome kits for the design team",
        "2026-09-02T10:00:00.000Z",
      );
  }
  products(): Product[] {
    return this.db
      .prepare("SELECT * FROM products ORDER BY unitCents")
      .all()
      .map(parseProduct);
  }
  product(id: string): Product | undefined {
    const row = this.db.prepare("SELECT * FROM products WHERE id = ?").get(id);
    return row ? parseProduct(row) : undefined;
  }
  invoices(tenantId: string): Invoice[] {
    return this.db
      .prepare(
        "SELECT * FROM invoices WHERE tenantId = ? ORDER BY createdAt DESC, id",
      )
      .all(tenantId)
      .map(parseInvoice);
  }
  invoice(id: string, tenantId: string): Invoice | undefined {
    const row = this.db
      .prepare("SELECT * FROM invoices WHERE id = ? AND tenantId = ?")
      .get(id, tenantId);
    return row ? parseInvoice(row) : undefined;
  }
  createInvoice(
    tenantId: string,
    product: Product,
    itemCount: number,
    totalCents: number,
    note: string,
  ): Invoice {
    const invoice: Invoice = {
      id: randomUUID(),
      tenantId,
      productName: product.name,
      itemCount,
      totalCents,
      note,
      createdAt: new Date().toISOString(),
    };
    this.db
      .prepare("INSERT INTO invoices VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(
        invoice.id,
        tenantId,
        product.name,
        itemCount,
        totalCents,
        note,
        invoice.createdAt,
      );
    return invoice;
  }
  close(): void {
    this.db.close();
  }
}
