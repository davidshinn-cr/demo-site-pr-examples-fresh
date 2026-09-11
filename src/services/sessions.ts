/** Opaque, expiring demo sessions. This identity switcher is for loopback demos only. */
import { randomBytes } from "node:crypto";
import type { User } from "../contracts/model.ts";
import { DEMO_USERS } from "../db/store.ts";
import { HttpError } from "../errors.ts";

export class Sessions {
  private readonly entries = new Map<
    string,
    { user: User; expiresAt: number }
  >();
  private readonly now: () => number;
  constructor(now: () => number = Date.now) {
    this.now = now;
  }
  create(userId: string): string {
    for (const [key, value] of this.entries)
      if (value.expiresAt <= this.now()) this.entries.delete(key);
    if (this.entries.size >= 1000)
      throw new HttpError(
        429,
        "Too many demo sessions. Restart the local server.",
      );
    const user = DEMO_USERS.find((candidate) => candidate.id === userId);
    if (!user) throw new HttpError(400, "Unknown demo user.");
    const token = randomBytes(32).toString("hex");
    this.entries.set(token, { user, expiresAt: this.now() + 3600000 });
    return token;
  }
  remove(token: string): void {
    this.entries.delete(token);
  }
  get(token: string): User {
    const entry = this.entries.get(token);
    if (!entry || entry.expiresAt <= this.now()) {
      this.entries.delete(token);
      throw new HttpError(401, "Choose a demo workspace to continue.");
    }
    return entry.user;
  }
}
