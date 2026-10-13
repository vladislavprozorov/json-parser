import { ParseFailure } from "../errors.ts";
import type { LoneSurrogateMode } from "../options.ts";
import {
  CH_0,
  CH_APOSTROPHE,
  CH_BACKSLASH,
  CH_CR,
  CH_LF,
  CH_LOWER_B,
  CH_LOWER_F,
  CH_LOWER_N,
  CH_LOWER_R,
  CH_LOWER_T,
  CH_LOWER_U,
  CH_LOWER_V,
  CH_LOWER_X,
  CH_QUOTE,
  CH_SLASH,
  CH_SPACE,
  hexValue,
  isDigit,
  isHighSurrogate,
  isLineTerminator,
  isLowSurrogate,
} from "./chars.ts";

export interface ScannedString {
  readonly end: number;
  readonly value: string;
}

export interface StringSyntax {
  readonly json5: boolean;
  readonly loneSurrogates: LoneSurrogateMode;
}

const REPLACEMENT_CHARACTER = String.fromCharCode(0xfffd);

export function scanString(
  text: string,
  start: number,
  syntax: StringSyntax,
): ScannedString {
  const quote = text.charCodeAt(start);
  let pos = start + 1;
  let chunkStart = pos;
  let value = "";

  for (;;) {
    const c = text.charCodeAt(pos);

    if (c === quote) {
      value += text.slice(chunkStart, pos);
      return { end: pos + 1, value };
    }

    if (c === CH_BACKSLASH) {
      value += text.slice(chunkStart, pos);
      const escapeStart = pos;
      const e = text.charCodeAt(pos + 1);
      pos += 2;
      switch (e) {
        case CH_QUOTE:
          value += '"';
          break;
        case CH_BACKSLASH:
          value += "\\";
          break;
        case CH_SLASH:
          value += "/";
          break;
        case CH_LOWER_B:
          value += "\b";
          break;
        case CH_LOWER_F:
          value += "\f";
          break;
        case CH_LOWER_N:
          value += "\n";
          break;
        case CH_LOWER_R:
          value += "\r";
          break;
        case CH_LOWER_T:
          value += "\t";
          break;
        case CH_LOWER_U: {
          const code = readHex4(text, pos);
          pos += 4;
          if (isHighSurrogate(code)) {
            if (
              text.charCodeAt(pos) === CH_BACKSLASH &&
              text.charCodeAt(pos + 1) === CH_LOWER_U
            ) {
              const low = readHex4(text, pos + 2);
              if (isLowSurrogate(low)) {
                value += String.fromCharCode(code, low);
                pos += 6;
                break;
              }
            }
            value += lone(code, escapeStart, syntax.loneSurrogates);
          } else if (isLowSurrogate(code)) {
            value += lone(code, escapeStart, syntax.loneSurrogates);
          } else {
            value += String.fromCharCode(code);
          }
          break;
        }
        default: {
          if (Number.isNaN(e)) {
            throw new ParseFailure("Unterminated string", escapeStart + 1);
          }
          if (!syntax.json5) {
            throw new ParseFailure("Invalid escape sequence", escapeStart + 1);
          }
          const escape = scanJson5Escape(text, escapeStart + 1);
          value += escape.value;
          pos = escape.end;
        }
      }
      chunkStart = pos;
      continue;
    }

    if (Number.isNaN(c)) {
      throw new ParseFailure("Unterminated string", pos);
    }
    if (c < CH_SPACE && (!syntax.json5 || c === CH_LF || c === CH_CR)) {
      throw new ParseFailure("Unescaped control character in string", pos);
    }
    pos++;
  }
}

export function isStringStart(c: number, syntax: StringSyntax): boolean {
  return c === CH_QUOTE || (c === CH_APOSTROPHE && syntax.json5);
}

export function readHex4(text: string, pos: number): number {
  let code = 0;
  for (let i = 0; i < 4; i++) {
    const h = hexValue(text.charCodeAt(pos + i));
    if (h < 0) {
      throw new ParseFailure(
        "Expected 4 hex digits in unicode escape",
        pos + i,
      );
    }
    code = (code << 4) | h;
  }
  return code;
}

function scanJson5Escape(text: string, at: number): ScannedString {
  const c = text.charCodeAt(at);
  switch (c) {
    case CH_LOWER_V:
      return { value: "\v", end: at + 1 };
    case CH_0:
      if (isDigit(text.charCodeAt(at + 1))) {
        throw new ParseFailure("Octal escape sequences are not allowed", at);
      }
      return { value: "\0", end: at + 1 };
    case CH_LOWER_X: {
      const high = hexValue(text.charCodeAt(at + 1));
      const low = hexValue(text.charCodeAt(at + 2));
      if (high < 0 || low < 0) {
        throw new ParseFailure(
          "Expected 2 hex digits in hex escape",
          high < 0 ? at + 1 : at + 2,
        );
      }
      return { value: String.fromCharCode((high << 4) | low), end: at + 3 };
    }
    case CH_CR: {
      const end = text.charCodeAt(at + 1) === CH_LF ? at + 2 : at + 1;
      return { value: "", end };
    }
  }
  if (isLineTerminator(c)) return { value: "", end: at + 1 };
  if (isDigit(c)) {
    throw new ParseFailure("Invalid escape sequence", at);
  }
  return { value: text.charAt(at), end: at + 1 };
}

function lone(code: number, position: number, mode: LoneSurrogateMode): string {
  switch (mode) {
    case "allow":
      return String.fromCharCode(code);
    case "replace":
      return REPLACEMENT_CHARACTER;
    case "error":
      throw new ParseFailure("Lone surrogate in string", position);
  }
}
