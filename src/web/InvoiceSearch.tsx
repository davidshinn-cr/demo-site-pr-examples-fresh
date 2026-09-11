/** Search result loading is cancellable and scoped to the active workspace component. */
import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactElement } from "react";
import { parseInvoice, parseList } from "../contracts/model.ts";
import type { Invoice } from "../contracts/model.ts";
import { api } from "./api.ts";

type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; invoices: Invoice[] }
  | { kind: "error"; message: string };
export function InvoiceSearch(): ReactElement {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ kind: "idle" });
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function search(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setState({ kind: "loading" });
    try {
      const value = await api(
        `/api/invoices/search?q=${encodeURIComponent(query)}`,
        { signal: abort.signal },
      );
      if (!abort.signal.aborted)
        setState({ kind: "ready", invoices: parseList(value, parseInvoice) });
    } catch (error: unknown) {
      if (!abort.signal.aborted)
        setState({
          kind: "error",
          message: error instanceof Error ? error.message : "Search failed.",
        });
    }
  }
  return (
    <div className="search-panel">
      <form
        onSubmit={(event) => {
          void search(event);
        }}
      >
        <label htmlFor="invoice-query">Find an invoice by product</label>
        <div className="search-controls">
          <input
            id="invoice-query"
            maxLength={100}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. Field notebook"
          />
          <button disabled={state.kind === "loading"}>Search invoices</button>
        </div>
      </form>
      <div aria-live="polite">
        {state.kind === "loading" && <p>Searching invoices…</p>}
        {state.kind === "error" && <p role="alert">{state.message}</p>}
        {state.kind === "ready" &&
          (state.invoices.length ? (
            <ul>
              {state.invoices.map((invoice) => (
                <li key={invoice.id}>
                  <a
                    href={`/api/invoices/${encodeURIComponent(invoice.id)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {invoice.productName} · {invoice.id.slice(0, 12)}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p>No invoices match this product. Try another name.</p>
          ))}
      </div>
    </div>
  );
}
