export type LargeIntegerMode = "number" | "bigint" | "string";

// что делать с \uD800–\uDFFF без пары: оставить (как JSON.parse),
// заменить на U+FFFD или бросить ошибку
export type LoneSurrogateMode = "allow" | "replace" | "error";

export interface ParseOptions {
  largeIntegers?: LargeIntegerMode;
  loneSurrogates?: LoneSurrogateMode;
}

export interface ResolvedOptions {
  largeIntegers: LargeIntegerMode;
  loneSurrogates: LoneSurrogateMode;
}

export function resolveOptions(options: ParseOptions = {}): ResolvedOptions {
  return {
    largeIntegers: options.largeIntegers ?? "number",
    loneSurrogates: options.loneSurrogates ?? "allow",
  };
}
