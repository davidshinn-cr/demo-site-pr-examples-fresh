/** Errors safe to expose at the HTTP boundary; unexpected errors stay private. */
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
