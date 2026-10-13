import { ParseFailure } from "../errors.ts";
import type { LargeIntegerMode } from "../options.ts";
import type { NumberValue } from "../types.ts";
import {
  CH_0,
  CH_DOT,
  CH_LOWER_E,
  CH_LOWER_X,
  CH_MINUS,
  CH_PLUS,
  CH_UPPER_E,
  CH_UPPER_I,
  CH_UPPER_N,
  CH_UPPER_X,
  hexValue,
  isDigit,
} from "./chars.ts";

export interface ScannedNumber {
  readonly end: number;
  readonly isInteger: boolean;
  readonly isHex: boolean;
}

export function scanNumber(text: string, start: number): ScannedNumber {
  let pos = start;
  if (text.charCodeAt(pos) === CH_MINUS) pos++;
  if (!isDigit(text.charCodeAt(pos))) {
    throw new ParseFailure("Expected digit", pos);
  }
  pos = scanIntegerPart(text, pos);

  let isInteger = true;
  if (text.charCodeAt(pos) === CH_DOT) {
    isInteger = false;
    pos++;
    if (!isDigit(text.charCodeAt(pos))) {
      throw new ParseFailure("Expected digit after decimal point", pos);
    }
    pos = skipDigits(text, pos + 1);
  }

  const end = scanExponent(text, pos);
  return { end, isInteger: isInteger && end === pos, isHex: false };
}

export function scanJson5Number(text: string, start: number): ScannedNumber {
  let pos = start;
  const sign = text.charCodeAt(pos);
  if (sign === CH_PLUS || sign === CH_MINUS) pos++;

  const c = text.charCodeAt(pos);
  if (c === CH_UPPER_I) return scanWord(text, pos, "Infinity");
  if (c === CH_UPPER_N) return scanWord(text, pos, "NaN");
  if (c === CH_0) {
    const x = text.charCodeAt(pos + 1);
    if (x === CH_LOWER_X || x === CH_UPPER_X) return scanHex(text, pos + 2);
  }

  let isInteger = true;
  if (isDigit(c)) {
    pos = scanIntegerPart(text, pos);
    if (text.charCodeAt(pos) === CH_DOT) {
      isInteger = false;
      pos = skipDigits(text, pos + 1);
    }
  } else if (c === CH_DOT && isDigit(text.charCodeAt(pos + 1))) {
    isInteger = false;
    pos = skipDigits(text, pos + 2);
  } else {
    throw new ParseFailure("Expected digit", c === CH_DOT ? pos + 1 : pos);
  }

  const end = scanExponent(text, pos);
  return { end, isInteger: isInteger && end === pos, isHex: false };
}

export function numberValue(
  raw: string,
  { isInteger, isHex }: ScannedNumber,
  largeIntegers: LargeIntegerMode,
): NumberValue {
  const value = isHex ? hexNumber(raw) : Number(raw);
  if (!isInteger || Number.isSafeInteger(value)) return value;
  switch (largeIntegers) {
    case "number":
      return value;
    case "bigint":
      return isHex ? hexBigInt(raw) : BigInt(raw);
    case "string":
      return raw;
  }
}

function scanIntegerPart(text: string, pos: number): number {
  if (text.charCodeAt(pos) !== CH_0) return skipDigits(text, pos + 1);
  if (isDigit(text.charCodeAt(pos + 1))) {
    throw new ParseFailure("Leading zeros are not allowed", pos + 1);
  }
  return pos + 1;
}

function scanExponent(text: string, pos: number): number {
  const e = text.charCodeAt(pos);
  if (e !== CH_LOWER_E && e !== CH_UPPER_E) return pos;
  pos++;
  const sign = text.charCodeAt(pos);
  if (sign === CH_PLUS || sign === CH_MINUS) pos++;
  if (!isDigit(text.charCodeAt(pos))) {
    throw new ParseFailure("Expected digit in exponent", pos);
  }
  return skipDigits(text, pos + 1);
}

function scanHex(text: string, pos: number): ScannedNumber {
  if (hexValue(text.charCodeAt(pos)) < 0) {
    throw new ParseFailure("Expected hex digit", pos);
  }
  do pos++;
  while (hexValue(text.charCodeAt(pos)) >= 0);
  return { end: pos, isInteger: true, isHex: true };
}

function scanWord(text: string, pos: number, word: string): ScannedNumber {
  if (!text.startsWith(word, pos)) {
    throw new ParseFailure(`Invalid number, expected "${word}"`, pos);
  }
  return { end: pos + word.length, isInteger: false, isHex: false };
}

function skipDigits(text: string, pos: number): number {
  while (isDigit(text.charCodeAt(pos))) pos++;
  return pos;
}

function splitSign(raw: string): { negative: boolean; digits: string } {
  const first = raw.charCodeAt(0);
  const signed = first === CH_MINUS || first === CH_PLUS;
  return { negative: first === CH_MINUS, digits: signed ? raw.slice(1) : raw };
}

function hexNumber(raw: string): number {
  const { negative, digits } = splitSign(raw);
  const magnitude = Number(digits);
  return negative ? -magnitude : magnitude;
}

function hexBigInt(raw: string): bigint {
  const { negative, digits } = splitSign(raw);
  const magnitude = BigInt(digits);
  return negative ? -magnitude : magnitude;
}
