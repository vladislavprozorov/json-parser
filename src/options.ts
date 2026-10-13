export type LargeIntegerMode = "number" | "bigint" | "string";
export type LoneSurrogateMode = "allow" | "replace" | "error";
export type ProtoKeyMode = "define" | "ignore" | "error";
export type DuplicateKeyMode = "last" | "first" | "error";

export interface ParseOptions {
  largeIntegers?: LargeIntegerMode;
  loneSurrogates?: LoneSurrogateMode;
  maxDepth?: number;
  maxLength?: number;
  protoKey?: ProtoKeyMode;
  duplicateKeys?: DuplicateKeyMode;
}

export interface ResolvedOptions {
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
    largeIntegers: options.largeIntegers ?? "number",
    loneSurrogates: options.loneSurrogates ?? "allow",
    maxDepth: limit("maxDepth", options.maxDepth ?? DEFAULT_MAX_DEPTH),
    maxLength: limit("maxLength", options.maxLength ?? Infinity),
    protoKey: options.protoKey ?? "define",
    duplicateKeys: options.duplicateKeys ?? "last",
  };
}

function limit(name: string, value: number): number {
  if (value === Infinity || (Number.isInteger(value) && value >= 0)) {
    return value;
  }
  throw new RangeError(
    `${name} must be a non-negative integer or Infinity, got ${value}`,
  );
}
