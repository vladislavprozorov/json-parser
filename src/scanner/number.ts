import { JSONParseError } from "../errors.ts";
import type { LargeIntegerMode } from "../options.ts";
import type { NumberValue } from "../types.ts";
import {
  CH_0,
  CH_1,
  CH_9,
  CH_DOT,
  CH_LOWER_E,
  CH_MINUS,
  CH_PLUS,
  CH_UPPER_E,
  isDigit,
} from "./chars.ts";

export interface ScannedNumber {
  end: number;
  isInteger: boolean;
}

export function scanNumber(text: string, start: number): ScannedNumber {
  let pos = start;
  let c = text.charCodeAt(pos);

  if (c === CH_MINUS) {
    c = text.charCodeAt(++pos);
  }
  if (c === CH_0) {
    pos++;
    if (isDigit(text.charCodeAt(pos))) {
      throw new JSONParseError("Leading zeros are not allowed", text, pos);
    }
  } else if (c >= CH_1 && c <= CH_9) {
    pos = skipDigits(text, pos + 1);
  } else {
    throw new JSONParseError("Expected digit", text, pos);
  }

  let isInteger = true;

  if (text.charCodeAt(pos) === CH_DOT) {
    isInteger = false;
    pos++;
    if (!isDigit(text.charCodeAt(pos))) {
      throw new JSONParseError("Expected digit after decimal point", text, pos);
    }
    pos = skipDigits(text, pos + 1);
  }

  c = text.charCodeAt(pos);
  if (c === CH_LOWER_E || c === CH_UPPER_E) {
    isInteger = false;
    c = text.charCodeAt(++pos);
    if (c === CH_PLUS || c === CH_MINUS) pos++;
    if (!isDigit(text.charCodeAt(pos))) {
      throw new JSONParseError("Expected digit in exponent", text, pos);
    }
    pos = skipDigits(text, pos + 1);
  }

  return { end: pos, isInteger };
}

export function numberValue(
  raw: string,
  isInteger: boolean,
  largeIntegers: LargeIntegerMode,
): NumberValue {
  const value = Number(raw);
  if (!isInteger || Number.isSafeInteger(value)) return value;
  switch (largeIntegers) {
    case "number":
      return value;
    case "bigint":
      return BigInt(raw);
    case "string":
      return raw;
  }
}

function skipDigits(text: string, pos: number): number {
  while (isDigit(text.charCodeAt(pos))) pos++;
  return pos;
}
