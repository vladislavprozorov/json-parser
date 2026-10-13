import { JSONParseError } from "../errors.ts";
import type { LoneSurrogateMode } from "../options.ts";
import {
  CH_BACKSLASH,
  CH_LOWER_B,
  CH_LOWER_F,
  CH_LOWER_N,
  CH_LOWER_R,
  CH_LOWER_T,
  CH_LOWER_U,
  CH_QUOTE,
  CH_SLASH,
  CH_SPACE,
  hexValue,
  isHighSurrogate,
  isLowSurrogate,
} from "./chars.ts";

export interface ScannedString {
  end: number;
  value: string;
}

export function scanString(
  text: string,
  start: number,
  loneSurrogates: LoneSurrogateMode,
): ScannedString {
  let pos = start + 1;
  let chunkStart = pos;
  let value = "";

  for (;;) {
    const c = text.charCodeAt(pos);

    if (c === CH_QUOTE) {
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
            value += lone(code, text, escapeStart, loneSurrogates);
          } else if (isLowSurrogate(code)) {
            value += lone(code, text, escapeStart, loneSurrogates);
          } else {
            value += String.fromCharCode(code);
          }
          break;
        }
        default:
          throw new JSONParseError(
            Number.isNaN(e) ? "Unterminated string" : "Invalid escape sequence",
            text,
            escapeStart + 1,
          );
      }
      chunkStart = pos;
      continue;
    }

    if (Number.isNaN(c)) {
      throw new JSONParseError("Unterminated string", text, pos);
    }
    if (c < CH_SPACE) {
      throw new JSONParseError(
        "Unescaped control character in string",
        text,
        pos,
      );
    }
    pos++;
  }
}

function readHex4(text: string, pos: number): number {
  let code = 0;
  for (let i = 0; i < 4; i++) {
    const h = hexValue(text.charCodeAt(pos + i));
    if (h < 0) {
      throw new JSONParseError(
        "Expected 4 hex digits in unicode escape",
        text,
        pos + i,
      );
    }
    code = (code << 4) | h;
  }
  return code;
}

function lone(
  code: number,
  text: string,
  position: number,
  mode: LoneSurrogateMode,
): string {
  switch (mode) {
    case "allow":
      return String.fromCharCode(code);
    case "replace":
      return "�";
    case "error":
      throw new JSONParseError("Lone surrogate in string", text, position);
  }
}
