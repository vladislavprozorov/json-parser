import { Parser } from "./parser.ts";
import type { JSONValue } from "./types.ts";

export function parse(text: string): JSONValue {
  return new Parser(text).parse();
}

export { JSONParseError } from "./errors.ts";
export type { JSONValue } from "./types.ts";
