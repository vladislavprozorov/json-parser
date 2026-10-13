export const CH_TAB = 0x09;
export const CH_LF = 0x0a;
export const CH_CR = 0x0d;
export const CH_SPACE = 0x20;
export const CH_PLUS = 0x2b;
export const CH_MINUS = 0x2d;
export const CH_DOT = 0x2e;
export const CH_0 = 0x30;
export const CH_1 = 0x31;
export const CH_9 = 0x39;
export const CH_UPPER_E = 0x45;
export const CH_LOWER_E = 0x65;

export function isDigit(c: number): boolean {
  return c >= CH_0 && c <= CH_9;
}

export function isWhitespace(c: number): boolean {
  return c === CH_SPACE || c === CH_TAB || c === CH_LF || c === CH_CR;
}
