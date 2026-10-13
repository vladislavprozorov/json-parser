import type { JSONArray, JSONObject, JSONValue } from "./types.ts";
import type { ResolvedOptions } from "./options.ts";
import { JSONParseError } from "./errors.ts";
import {
  CH_COLON,
  CH_COMMA,
  CH_QUOTE,
  CH_RBRACE,
  CH_RBRACKET,
  isWhitespace,
} from "./scanner/chars.ts";
import { scanNumber } from "./scanner/number.ts";
import { scanString } from "./scanner/string.ts";

export class Parser {
  private readonly text: string;
  private readonly options: ResolvedOptions;
  private pos = 0;
  private depth = 0;

  constructor(text: string, options: ResolvedOptions) {
    this.text = text;
    this.options = options;
  }

  parse(): JSONValue {
    if (this.text.length > this.options.maxLength) {
      throw this.error(
        `Input length ${this.text.length} exceeds maxLength of ${this.options.maxLength}`,
        this.options.maxLength,
      );
    }
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
      case "{":
        return this.parseObject();
      case "[":
        return this.parseArray();
      case '"':
        return this.parseString();
      case "t":
        return this.parseLiteral("true", true);
      case "f":
        return this.parseLiteral("false", false);
      case "n":
        return this.parseLiteral("null", null);
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

  private parseArray(): JSONArray {
    this.enter();
    const result: JSONArray = [];
    this.skipWhitespace();
    if (this.text.charCodeAt(this.pos) === CH_RBRACKET) {
      return this.leave(result);
    }
    for (;;) {
      this.skipWhitespace();
      result.push(this.parseValue());
      this.skipWhitespace();
      const c = this.text.charCodeAt(this.pos);
      if (c === CH_COMMA) {
        this.pos++;
      } else if (c === CH_RBRACKET) {
        return this.leave(result);
      } else {
        throw this.error(
          `Expected "," or "]" in array, got ${this.describeCurrent()}`,
        );
      }
    }
  }

  private parseObject(): JSONObject {
    this.enter();
    const result: JSONObject = {};
    this.skipWhitespace();
    if (this.text.charCodeAt(this.pos) === CH_RBRACE) {
      return this.leave(result);
    }
    for (;;) {
      this.skipWhitespace();
      if (this.text.charCodeAt(this.pos) !== CH_QUOTE) {
        throw this.error(
          `Expected string key in object, got ${this.describeCurrent()}`,
        );
      }
      const keyStart = this.pos;
      const key = this.parseString();
      this.skipWhitespace();
      if (this.text.charCodeAt(this.pos) !== CH_COLON) {
        throw this.error(
          `Expected ":" after object key, got ${this.describeCurrent()}`,
        );
      }
      this.pos++;
      this.skipWhitespace();
      const value = this.parseValue();
      this.setProperty(result, key, value, keyStart);
      this.skipWhitespace();
      const c = this.text.charCodeAt(this.pos);
      if (c === CH_COMMA) {
        this.pos++;
      } else if (c === CH_RBRACE) {
        return this.leave(result);
      } else {
        throw this.error(
          `Expected "," or "}" in object, got ${this.describeCurrent()}`,
        );
      }
    }
  }

  private setProperty(
    target: JSONObject,
    key: string,
    value: JSONValue,
    keyStart: number,
  ): void {
    const isProto = key === "__proto__";
    if (isProto) {
      switch (this.options.protoKey) {
        case "ignore":
          return;
        case "error":
          throw this.error('Forbidden key "__proto__"', keyStart);
      }
    }
    if (Object.hasOwn(target, key)) {
      switch (this.options.duplicateKeys) {
        case "first":
          return;
        case "error":
          throw this.error(`Duplicate key ${JSON.stringify(key)}`, keyStart);
      }
    }
    if (isProto) {
      Object.defineProperty(target, key, {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    } else {
      target[key] = value;
    }
  }

  private enter(): void {
    if (this.depth >= this.options.maxDepth) {
      throw this.error(
        `Maximum nesting depth of ${this.options.maxDepth} exceeded`,
      );
    }
    this.depth++;
    this.pos++;
  }

  private leave<T>(value: T): T {
    this.depth--;
    this.pos++;
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

  private error(message: string, position = this.pos): JSONParseError {
    return new JSONParseError(message, this.text, position);
  }
}
