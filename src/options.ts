export type LargeIntegerMode = "number" | "bigint" | "string";
export type LoneSurrogateMode = "allow" | "replace" | "error";
export type ProtoKeyMode = "define" | "ignore" | "error";
export type DuplicateKeyMode = "last" | "first" | "error";
export type Dialect = "json" | "jsonc" | "json5";

export interface SyntaxFeatures {
  readonly comments: boolean;
  readonly trailingCommas: boolean;
  readonly json5: boolean;
}

const SYNTAX: Readonly<Record<Dialect, SyntaxFeatures>> = {
  json: { comments: false, trailingCommas: false, json5: false },
  jsonc: { comments: true, trailingCommas: true, json5: false },
  json5: { comments: true, trailingCommas: true, json5: true },
};

export interface ParseOptions {
  dialect?: Dialect;
  largeIntegers?: LargeIntegerMode;
  loneSurrogates?: LoneSurrogateMode;
  maxDepth?: number;
  maxLength?: number;
  protoKey?: ProtoKeyMode;
  duplicateKeys?: DuplicateKeyMode;
}

export interface ResolvedOptions {
  syntax: SyntaxFeatures;
  largeIntegers: LargeIntegerMode;
  loneSurrogates: LoneSurrogateMode;
  maxDepth: number;
  maxLength: number;
  protoKey: ProtoKeyMode;
  duplicateKeys: DuplicateKeyMode;
}

export const DEFAULT_MAX_DEPTH = 1000;

export function resolveOptions(options: ParseOptions = {}): ResolvedOptions {
  return {
    syntax: syntaxOf(options.dialect ?? "json"),
    largeIntegers: options.largeIntegers ?? "number",
    loneSurrogates: options.loneSurrogates ?? "allow",
    maxDepth: limit("maxDepth", options.maxDepth ?? DEFAULT_MAX_DEPTH),
    maxLength: limit("maxLength", options.maxLength ?? Infinity),
    protoKey: options.protoKey ?? "define",
    duplicateKeys: options.duplicateKeys ?? "last",
  };
}

function syntaxOf(dialect: Dialect): SyntaxFeatures {
  if (!Object.hasOwn(SYNTAX, dialect)) {
    throw new RangeError(
      `dialect must be one of ${Object.keys(SYNTAX).join(", ")}, got ${dialect}`,
    );
  }
  return SYNTAX[dialect];
}

function limit(name: string, value: number): number {
  if (value === Infinity || (Number.isInteger(value) && value >= 0)) {
    return value;
  }
  throw new RangeError(
    `${name} must be a non-negative integer or Infinity, got ${value}`,
  );
}
