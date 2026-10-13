import type { JSONValue } from "./types.ts";
import type { ResolvedOptions } from "./options.ts";
import { JSONParseError } from "./errors.ts";
import { isWhitespace } from "./scanner/chars.ts";
import { scanNumber } from "./scanner/number.ts";
import { scanString } from "./scanner/string.ts";

export class Parser {
  private readonly text: string;
  private readonly options: ResolvedOptions;
  private pos = 0;

  constructor(text: string, options: ResolvedOptions) {
    this.text = text;
    this.options = options;
  }

  parse(): JSONValue {
    this.skipWhitespace();
    const value = this.parseValue();
    this.skipWhitespace();
    if (this.pos < this.text.length) {
      throw this.error(`Unexpected ${this.describeCurrent()} after JSON value`);
    }
    return value;
  }

  private parseValue(): JSONValue {
    const ch = this.text[this.pos];
    switch (ch) {
      case "t":
        return this.parseLiteral("true", true);
      case "f":
        return this.parseLiteral("false", false);
      case "n":
        return this.parseLiteral("null", null);
      case '"':
        return this.parseString();
      case "-":
      case "0":
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
        return this.parseNumber();
      case undefined:
        throw this.error("Unexpected end of input");
      default:
        throw this.error(`Unexpected ${this.describeCurrent()}`);
    }
  }

  private parseNumber(): JSONValue {
    const start = this.pos;
    const { end, isInteger } = scanNumber(this.text, start);
    this.pos = end;

    const raw = this.text.slice(start, end);
    const value = Number(raw);

    if (isInteger && !Number.isSafeInteger(value)) {
      switch (this.options.largeIntegers) {
        case "bigint":
          return BigInt(raw);
        case "string":
          return raw;
      }
    }
    return value;
  }

  private parseString(): string {
    const { end, value } = scanString(
      this.text,
      this.pos,
      this.options.loneSurrogates,
    );
    this.pos = end;
    return value;
  }

  private parseLiteral<T extends JSONValue>(word: string, value: T): T {
    if (this.text.startsWith(word, this.pos)) {
      this.pos += word.length;
      return value;
    }
    throw this.error(`Invalid literal, expected "${word}"`);
  }

  private skipWhitespace(): void {
    while (isWhitespace(this.text.charCodeAt(this.pos))) this.pos++;
  }

  private describeCurrent(): string {
    const ch = this.text[this.pos];
    return ch === undefined ? "end of input" : `character "${ch}"`;
  }

  private error(message: string): JSONParseError {
    return new JSONParseError(message, this.text, this.pos);
  }
}
