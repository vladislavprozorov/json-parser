export const CH_TAB = 0x09;
export const CH_LF = 0x0a;
export const CH_CR = 0x0d;
export const CH_SPACE = 0x20;
export const CH_QUOTE = 0x22;
export const CH_PLUS = 0x2b;
export const CH_COMMA = 0x2c;
export const CH_MINUS = 0x2d;
export const CH_DOT = 0x2e;
export const CH_SLASH = 0x2f;
export const CH_0 = 0x30;
export const CH_1 = 0x31;
export const CH_9 = 0x39;
export const CH_COLON = 0x3a;
export const CH_UPPER_A = 0x41;
export const CH_UPPER_E = 0x45;
export const CH_UPPER_F = 0x46;
export const CH_LBRACKET = 0x5b;
export const CH_BACKSLASH = 0x5c;
export const CH_RBRACKET = 0x5d;
export const CH_LOWER_A = 0x61;
export const CH_LOWER_B = 0x62;
export const CH_LOWER_E = 0x65;
export const CH_LOWER_F = 0x66;
export const CH_LOWER_N = 0x6e;
export const CH_LOWER_R = 0x72;
export const CH_LOWER_T = 0x74;
export const CH_LOWER_U = 0x75;
export const CH_LBRACE = 0x7b;
export const CH_RBRACE = 0x7d;

export function isDigit(c: number): boolean {
  return c >= CH_0 && c <= CH_9;
}

export function isWhitespace(c: number): boolean {
  return c === CH_SPACE || c === CH_TAB || c === CH_LF || c === CH_CR;
}

export function hexValue(c: number): number {
  if (c >= CH_0 && c <= CH_9) return c - CH_0;
  if (c >= CH_UPPER_A && c <= CH_UPPER_F) return c - CH_UPPER_A + 10;
  if (c >= CH_LOWER_A && c <= CH_LOWER_F) return c - CH_LOWER_A + 10;
  return -1;
}

export function isHighSurrogate(c: number): boolean {
  return c >= 0xd800 && c <= 0xdbff;
}

export function isLowSurrogate(c: number): boolean {
  return c >= 0xdc00 && c <= 0xdfff;
}
