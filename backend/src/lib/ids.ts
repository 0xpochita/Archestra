import { ulid } from "ulid";

type IdPrefix = "wf" | "run" | "step" | "msg" | "sess" | "draft" | "req";

export function generateId(prefix: IdPrefix): string {
  return `${prefix}_${ulid()}`;
}

export type IdGenerator = typeof generateId;
