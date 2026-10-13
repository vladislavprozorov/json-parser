import { Parser } from "./parser.ts";
import { resolveOptions, type ParseOptions } from "./options.ts";
import type { JSONValue } from "./types.ts";

export function parse(text: string, options?: ParseOptions): JSONValue {
  return new Parser(text, resolveOptions(options)).parse();
}

export { JSONParseError } from "./errors.ts";
export { DEFAULT_MAX_DEPTH } from "./options.ts";
export type { JSONValue, JSONArray, JSONObject } from "./types.ts";
export type {
  ParseOptions,
  LargeIntegerMode,
  LoneSurrogateMode,
  ProtoKeyMode,
  DuplicateKeyMode,
} from "./options.ts";
