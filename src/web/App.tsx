/** Purchase workspace with explicit session, loading, and mutation states. */
import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactElement } from "react";
import type { Invoice, Product, User } from "../contracts/model.ts";
import {
  parseInvoice,
  parseList,
  parseProduct,
  parseUser,
} from "../contracts/model.ts";
import { checkoutSummary, formatCents } from "../consumer/checkout-summary.ts";
import { api } from "./api.ts";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; users: User[] };
type WorkspaceState =
  | { kind: "signed-out" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; user: User; products: Product[]; invoices: Invoice[] };
type ActionState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };
const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : "Unable to complete the request.";

export function App(): ReactElement {
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [workspace, setWorkspace] = useState<WorkspaceState>({
    kind: "signed-out",
  });
  const [attempt, setAttempt] = useState(0);
  const sessionRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void api("/api/demo-users", { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted)
          setLoad({ kind: "ready", users: parseList(value, parseUser) });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setLoad({ kind: "error", message: messageOf(error) });
      });
    return () => {
      controller.abort();
      sessionRequest.current?.abort();
    };
  }, [attempt]);
  async function selectUser(userId: string): Promise<void> {
    sessionRequest.current?.abort();
    const controller = new AbortController();
    sessionRequest.current = controller;
    setWorkspace({ kind: "loading" });
    try {
      const user = parseUser(
        await api("/api/session", {
          method: "POST",
          body: JSON.stringify({ userId }),
          signal: controller.signal,
        }),
      );
      const [products, invoices] = await Promise.all([
        api("/api/products", { signal: controller.signal }),
        api("/api/invoices", { signal: controller.signal }),
      ]);
      if (!controller.signal.aborted)
        setWorkspace({
          kind: "ready",
          user,
          products: parseList(products, parseProduct),
          invoices: parseList(invoices, parseInvoice),
        });
    } catch (error: unknown) {
      if (!controller.signal.aborted)
        setWorkspace({ kind: "error", message: messageOf(error) });
    }
  }
  return (
    <>
      <header className="topbar">
        <img
          src="/brand/coderabbit-white.svg"
          alt="CodeRabbit"
          width="156"
          height="32"
        />
        <span className="app-name">Quote to order</span>
        <span className="demo-badge">Local demo</span>
      </header>
      <div className="layout">
        <aside>
          <p className="rail-label">Purchase workspace</p>
          <p className="active-page">Orders & invoices</p>
          <div className="workspace-switch">
            <label htmlFor="workspace">Demo identity</label>
            {load.kind === "ready" ? (
              <select
                id="workspace"
                defaultValue=""
                disabled={workspace.kind === "loading"}
                onChange={(event) => {
                  void selectUser(event.target.value);
                }}
              >
                <option value="" disabled>
                  Choose a workspace
                </option>
                {load.users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.organization} · {user.role}
                  </option>
                ))}
              </select>
            ) : load.kind === "loading" ? (
              <p role="status">Loading workspaces…</p>
            ) : (
              <>
                <p role="alert">{load.message}</p>
                <button
                  onClick={() => {
                    setLoad({ kind: "loading" });
                    setAttempt((value) => value + 1);
                  }}
                >
                  Retry connection
                </button>
              </>
            )}
            {workspace.kind === "ready" && (
              <p className="identity">
                {workspace.user.name}
                <br />
                <span>{workspace.user.organization}</span>
              </p>
            )}
          </div>
          <p className="rail-foot">
            Synthetic purchases.
            <br />
            Real review conversations.
          </p>
        </aside>
        <main>
          <div className="page-title">
            <div>
              <p className="breadcrumb">Workspace / Purchasing</p>
              <h1>Orders & invoices</h1>
              <p>Equip your team. Keep every purchase in view.</p>
            </div>
          </div>
          {workspace.kind === "signed-out" && (
            <section className="empty">
              <h2>Your next team order starts here.</h2>
              <p>
                Choose a demo identity to browse the catalog, create a quote,
                and view your organization’s invoices.
              </p>
            </section>
          )}
          {workspace.kind === "loading" && (
            <section className="empty" role="status">
              Loading your workspace…
            </section>
          )}
          {workspace.kind === "error" && (
            <p role="alert">
              {workspace.message} Choose a workspace to try again.
            </p>
          )}
          {workspace.kind === "ready" && (
            <PurchaseWorkspace
              key={workspace.user.id}
              user={workspace.user}
              products={workspace.products}
              initialInvoices={workspace.invoices}
            />
          )}
        </main>
      </div>
      <footer>
        CodeRabbit Solutions Architecture{" "}
        <span>Quote-to-order example application</span>
      </footer>
    </>
  );
}

interface PurchaseProps {
  readonly user: User;
  readonly products: readonly Product[];
  readonly initialInvoices: readonly Invoice[];
}
export function PurchaseWorkspace({
  user,
  products,
  initialInvoices,
}: PurchaseProps): ReactElement {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [invoices, setInvoices] = useState(initialInvoices);
  const [action, setAction] = useState<ActionState>({ kind: "idle" });
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const intent =
      event.nativeEvent instanceof SubmitEvent &&
      event.nativeEvent.submitter?.getAttribute("value") === "order"
        ? "order"
        : "quote";
    const abort = new AbortController();
    controller.current?.abort();
    controller.current = abort;
    setAction({ kind: "pending" });
    try {
      const value = await api(
        intent === "order" ? "/api/orders" : "/api/pricing/quote",
        {
          method: "POST",
          body: JSON.stringify({
            productId,
            itemCount: Number(quantity),
            note,
          }),
          signal: abort.signal,
        },
      );
      if (abort.signal.aborted) return;
      if (intent === "order") {
        const invoice = parseInvoice(value);
        setInvoices((previous) => [invoice, ...previous]);
        setAction({
          kind: "success",
          message: `Order placed. ${formatCents(invoice.totalCents)} added to your invoices.`,
        });
      } else setAction({ kind: "success", message: checkoutSummary(value) });
    } catch (error: unknown) {
      if (!abort.signal.aborted)
        setAction({ kind: "error", message: messageOf(error) });
    }
  }
  return (
    <>
      <section className="purchase">
        <div className="catalog">
          <h2>The team catalog</h2>
          <p>Considered essentials for the everyday.</p>
          {products.map((product) => (
            <label
              className={`product-row ${productId === product.id ? "selected" : ""}`}
              key={product.id}
            >
              <input
                type="radio"
                name="product"
                value={product.id}
                checked={productId === product.id}
                disabled={action.kind === "pending"}
                onChange={() => {
                  setProductId(product.id);
                  setAction({ kind: "idle" });
                }}
              />
              <span>
                <strong>{product.name}</strong>
                <small>{product.description}</small>
              </span>
              <span className="money">{formatCents(product.unitCents)}</span>
            </label>
          ))}
        </div>
        <form
          onSubmit={(event) => {
            void submit(event);
          }}
        >
          <h2>Create an order</h2>
          <p>Purchasing for {user.organization}</p>
          <fieldset disabled={action.kind === "pending"}>
            <label htmlFor="quantity">
              Quantity <span>1–100 items</span>
            </label>
            <input
              id="quantity"
              type="number"
              min="1"
              max="100"
              required
              value={quantity}
              onChange={(event) => {
                setQuantity(event.target.value);
                setAction({ kind: "idle" });
              }}
            />
            <label htmlFor="note">
              Invoice note <span>Optional</span>
            </label>
            <textarea
              id="note"
              rows={3}
              maxLength={500}
              placeholder="e.g. Welcome kits for the design team"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            <div className="actions">
              <button type="submit" value="quote">
                Preview quote
              </button>
              <button
                className="primary"
                type="submit"
                value="order"
                disabled={!productId}
              >
                Place order
              </button>
            </div>
          </fieldset>
          <div className="action-status" aria-live="polite">
            {action.kind === "pending" ? (
              "Processing…"
            ) : action.kind === "success" ? (
              action.message
            ) : action.kind === "error" ? (
              <span role="alert">{action.message}</span>
            ) : (
              "Prices are in USD. No real payment is collected."
            )}
          </div>
        </form>
      </section>
      <section className="invoice-section">
        <div className="section-title">
          <h2>Recent invoices</h2>
          <span>{invoices.length} invoices</span>
        </div>
        {invoices.length === 0 ? (
          <p>Your first order will appear here.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <caption className="sr-only">
                Invoices for {user.organization}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Note</th>
                  <th scope="col">Quantity</th>
                  <th scope="col">Total</th>
                  <th scope="col">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <strong>{invoice.productName}</strong>
                      <small className="invoice-id">
                        {invoice.id.slice(0, 12)}
                      </small>
                    </td>
                    <td className="invoice-note">{invoice.note || "—"}</td>
                    <td>{invoice.itemCount}</td>
                    <td className="money">{formatCents(invoice.totalCents)}</td>
                    <td>
                      <a
                        href={`/api/invoices/${encodeURIComponent(invoice.id)}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`View invoice ${invoice.id}`}
                      >
                        View ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
