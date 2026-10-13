import { ParseFailure } from "../errors.ts";
import { CH_SLASH, CH_STAR, isLineTerminator } from "./chars.ts";

export function scanComment(text: string, start: number): number {
  const kind = text.charCodeAt(start + 1);
  if (kind === CH_SLASH) {
    let pos = start + 2;
    while (pos < text.length && !isLineTerminator(text.charCodeAt(pos))) pos++;
    return pos;
  }
  if (kind === CH_STAR) {
    const close = text.indexOf("*/", start + 2);
    if (close === -1) {
      throw new ParseFailure("Unterminated block comment", start);
    }
    return close + 2;
  }
  throw new ParseFailure('Expected "//" or "/*" to start a comment', start);
}
