/** Runtime-validated client boundary with bounded and cancellable requests. */
import { isRecord } from "../contracts/model.ts";
export async function api(
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const timeout = AbortSignal.timeout(10000);
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
    signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
  });
  const value: unknown = await response.json();
  if (!response.ok)
    throw new Error(
      isRecord(value) && typeof value.error === "string"
        ? value.error
        : "Request failed.",
    );
  return value;
}
