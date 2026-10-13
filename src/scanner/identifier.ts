import { ParseFailure } from "../errors.ts";
import { CH_BACKSLASH, CH_LOWER_U } from "./chars.ts";
import { readHex4, type ScannedString } from "./string.ts";

const START = /[\p{L}\p{Nl}$_]/uy;
const PART = /[\p{L}\p{Nl}\p{Mn}\p{Mc}\p{Nd}\p{Pc}$_]/uy;
const ZWNJ = 0x200c;
const ZWJ = 0x200d;

export function isIdentifierStart(text: string, pos: number): boolean {
  return text.charCodeAt(pos) === CH_BACKSLASH || match(START, text, pos) > 0;
}

export function scanIdentifier(text: string, start: number): ScannedString {
  let pos = start;
  let chunkStart = pos;
  let value = "";

  for (;;) {
    const first = pos === start;

    if (text.charCodeAt(pos) === CH_BACKSLASH) {
      if (text.charCodeAt(pos + 1) !== CH_LOWER_U) {
        throw new ParseFailure('Expected "\\u" escape in identifier', pos);
      }
      const char = String.fromCharCode(readHex4(text, pos + 2));
      if (identifierCharLength(char, 0, first) === 0) {
        throw new ParseFailure("Invalid identifier character in escape", pos);
      }
      value += text.slice(chunkStart, pos) + char;
      pos += 6;
      chunkStart = pos;
      continue;
    }

    const length = identifierCharLength(text, pos, first);
    if (length === 0) break;
    pos += length;
  }

  if (pos === start) {
    throw new ParseFailure("Expected identifier", start);
  }
  return { end: pos, value: value + text.slice(chunkStart, pos) };
}

function identifierCharLength(
  text: string,
  pos: number,
  first: boolean,
): number {
  if (first) return match(START, text, pos);
  const c = text.charCodeAt(pos);
  if (c === ZWNJ || c === ZWJ) return 1;
  return match(PART, text, pos);
}

function match(pattern: RegExp, text: string, pos: number): number {
  pattern.lastIndex = pos;
  return pattern.test(text) ? pattern.lastIndex - pos : 0;
}
