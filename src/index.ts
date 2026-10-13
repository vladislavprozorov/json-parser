import type { ValueNode } from "./ast.ts";
import type { Builder } from "./builders/builder.ts";
import { createAstBuilder } from "./builders/ast-builder.ts";
import { valueBuilder } from "./builders/value-builder.ts";
import { resolveOptions, type ParseOptions } from "./options.ts";
import { Parser } from "./parser.ts";
import type { JSONValue } from "./types.ts";

export function parse(text: string, options?: ParseOptions): JSONValue {
  return parseWith(text, valueBuilder, options);
}

export function parseAst(text: string, options?: ParseOptions): ValueNode {
  return parseWith(text, createAstBuilder(text), options);
}

export function parseWith<Value, ArrayState, ObjectState>(
  text: string,
  builder: Builder<Value, ArrayState, ObjectState>,
  options?: ParseOptions,
): Value {
  return new Parser(text, builder, resolveOptions(options)).parse();
}

export { JSONParseError } from "./errors.ts";
export { DEFAULT_MAX_DEPTH } from "./options.ts";
export { LineIndex } from "./location.ts";
export { formatPath } from "./path.ts";
export type { Position, SourceLocation } from "./location.ts";
export type { PathSegment } from "./path.ts";
export type { Builder } from "./builders/builder.ts";
export type {
  JSONValue,
  JSONArray,
  JSONObject,
  NumberValue,
} from "./types.ts";
export type {
  AstNode,
  ValueNode,
  NullNode,
  BooleanNode,
  NumberNode,
  StringNode,
  ArrayNode,
  ObjectNode,
  MemberNode,
} from "./ast.ts";
export type {
  ParseOptions,
  LargeIntegerMode,
  LoneSurrogateMode,
  ProtoKeyMode,
  DuplicateKeyMode,
  Dialect,
} from "./options.ts";
