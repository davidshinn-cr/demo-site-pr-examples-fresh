/** Batch entry uses the same catalog and purchase validation as single checkout. */
import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactElement } from "react";
import type { Invoice, PurchaseRequest } from "../contracts/model.ts";
import { parseInvoice, parseList } from "../contracts/model.ts";
import { api } from "./api.ts";

type BatchState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "success"; count: number }
  | { kind: "error"; message: string };
export function parseBatchText(text: string): PurchaseRequest[] {
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      const [productId, quantity, ...note] = line.split(",");
      return {
        productId: productId?.trim() ?? "",
        itemCount: Number(quantity),
        note: note.join(",").trim(),
      };
    });
}
export function BulkCheckout({
  onCreated,
}: {
  readonly onCreated: (invoices: Invoice[]) => void;
}): ReactElement {
  const [text, setText] = useState(
    "notebook, 10, Team welcome kits\ndesk-kit, 2, New starters",
  );
  const [state, setState] = useState<BatchState>({ kind: "idle" });
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setState({ kind: "pending" });
    try {
      const value = await api("/api/orders/bulk", {
        method: "POST",
        body: JSON.stringify({ items: parseBatchText(text) }),
        signal: abort.signal,
      });
      if (abort.signal.aborted) return;
      const invoices = parseList(value, parseInvoice);
      onCreated(invoices);
      setState({ kind: "success", count: invoices.length });
    } catch (error: unknown) {
      if (!abort.signal.aborted)
        setState({
          kind: "error",
          message: error instanceof Error ? error.message : "Batch failed.",
        });
    }
  }
  return (
    <details className="bulk-panel">
      <summary>Order for the whole team</summary>
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <label htmlFor="batch-items">Bulk order lines</label>
        <p id="batch-help">
          One product per line: product ID, quantity, optional note. Use
          notebook, desk-kit, or travel-pack. Up to 10 lines.
        </p>
        <textarea
          id="batch-items"
          aria-describedby="batch-help"
          rows={4}
          maxLength={6000}
          value={text}
          disabled={state.kind === "pending"}
          onChange={(event) => setText(event.target.value)}
        />
        <button className="primary" disabled={state.kind === "pending"}>
          Place bulk order
        </button>
        <div aria-live="polite">
          {state.kind === "pending" ? (
            "Placing orders…"
          ) : state.kind === "success" ? (
            `${state.count} invoices created.`
          ) : state.kind === "error" ? (
            <p role="alert">{state.message}</p>
          ) : null}
        </div>
      </form>
    </details>
  );
}
