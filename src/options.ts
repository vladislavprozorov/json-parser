export type LargeIntegerMode = "number" | "bigint" | "string";

export interface ParseOptions {
  largeIntegers?: LargeIntegerMode;
}

export interface ResolvedOptions {
  largeIntegers: LargeIntegerMode;
}

export function resolveOptions(options: ParseOptions = {}): ResolvedOptions {
  return {
    largeIntegers: options.largeIntegers ?? "number",
  };
}
