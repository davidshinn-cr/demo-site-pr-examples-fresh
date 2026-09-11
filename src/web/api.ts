/** Runtime-validated client boundary with bounded and cancellable requests. */
import { isRecord } from "../contracts/model.ts";
export async function api(
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const timeout = AbortSignal.timeout(10000);
  const headers = new Headers(init.headers);
  if (!headers.has("content-type"))
    headers.set("content-type", "application/json");
  const response = await fetch(path, {
    ...init,
    headers,
    signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
  });
  if (!response.ok) {
    const fallback = `Request failed (${response.status}${response.statusText ? ` ${response.statusText}` : ""}).`;
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new Error(fallback);
    }
    throw new Error(
      isRecord(value) && typeof value.error === "string"
        ? value.error
        : fallback,
    );
  }
  return response.json();
}
