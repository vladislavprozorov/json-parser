import type { Builder } from "./builders/builder.ts";
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
import { numberValue, scanNumber } from "./scanner/number.ts";
import { scanString, type ScannedString } from "./scanner/string.ts";

export class Parser<Value, ArrayState, ObjectState> {
  private readonly text: string;
  private readonly builder: Builder<Value, ArrayState, ObjectState>;
  private readonly options: ResolvedOptions;
  private pos = 0;
  private depth = 0;

  constructor(
    text: string,
    builder: Builder<Value, ArrayState, ObjectState>,
    options: ResolvedOptions,
  ) {
    this.text = text;
    this.builder = builder;
    this.options = options;
  }

  parse(): Value {
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

  private parseValue(): Value {
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

  private parseArray(): Value {
    const array = this.builder.startArray(this.enter());
    this.skipWhitespace();
    if (this.text.charCodeAt(this.pos) === CH_RBRACKET) {
      return this.builder.endArray(array, this.leave());
    }
    for (;;) {
      this.skipWhitespace();
      this.builder.addElement(array, this.parseValue());
      this.skipWhitespace();
      const c = this.text.charCodeAt(this.pos);
      if (c === CH_COMMA) {
        this.pos++;
      } else if (c === CH_RBRACKET) {
        return this.builder.endArray(array, this.leave());
      } else {
        throw this.error(
          `Expected "," or "]" in array, got ${this.describeCurrent()}`,
        );
      }
    }
  }

  private parseObject(): Value {
    const object = this.builder.startObject(this.enter());
    this.skipWhitespace();
    if (this.text.charCodeAt(this.pos) === CH_RBRACE) {
      return this.builder.endObject(object, this.leave());
    }
    for (;;) {
      this.skipWhitespace();
      if (this.text.charCodeAt(this.pos) !== CH_QUOTE) {
        throw this.error(
          `Expected string key in object, got ${this.describeCurrent()}`,
        );
      }
      const keyStart = this.pos;
      const key = this.scanString();
      this.skipWhitespace();
      if (this.text.charCodeAt(this.pos) !== CH_COLON) {
        throw this.error(
          `Expected ":" after object key, got ${this.describeCurrent()}`,
        );
      }
      this.pos++;
      this.skipWhitespace();
      const value = this.parseValue();
      this.addMember(object, key.value, keyStart, key.end, value);
      this.skipWhitespace();
      const c = this.text.charCodeAt(this.pos);
      if (c === CH_COMMA) {
        this.pos++;
      } else if (c === CH_RBRACE) {
        return this.builder.endObject(object, this.leave());
      } else {
        throw this.error(
          `Expected "," or "}" in object, got ${this.describeCurrent()}`,
        );
      }
    }
  }

  private addMember(
    object: ObjectState,
    key: string,
    keyStart: number,
    keyEnd: number,
    value: Value,
  ): void {
    if (key === "__proto__") {
      switch (this.options.protoKey) {
        case "ignore":
          return;
        case "error":
          throw this.error('Forbidden key "__proto__"', keyStart);
      }
    }
    if (this.builder.hasKey(object, key)) {
      switch (this.options.duplicateKeys) {
        case "first":
          return;
        case "error":
          throw this.error(`Duplicate key ${JSON.stringify(key)}`, keyStart);
      }
    }
    this.builder.setProperty(object, key, keyStart, keyEnd, value);
  }

  private enter(): number {
    if (this.depth >= this.options.maxDepth) {
      throw this.error(
        `Maximum nesting depth of ${this.options.maxDepth} exceeded`,
      );
    }
    this.depth++;
    return this.pos++;
  }

  private leave(): number {
    this.depth--;
    return ++this.pos;
  }

  private parseString(): Value {
    const start = this.pos;
    const { value, end } = this.scanString();
    return this.builder.string(value, start, end);
  }

  private scanString(): ScannedString {
    const scanned = scanString(
      this.text,
      this.pos,
      this.options.loneSurrogates,
    );
    this.pos = scanned.end;
    return scanned;
  }

  private parseNumber(): Value {
    const start = this.pos;
    const { end, isInteger } = scanNumber(this.text, start);
    this.pos = end;
    const raw = this.text.slice(start, end);
    const value = numberValue(raw, isInteger, this.options.largeIntegers);
    return this.builder.number(value, raw, start, end);
  }

  private parseLiteral(word: string, value: boolean | null): Value {
    if (!this.text.startsWith(word, this.pos)) {
      throw this.error(`Invalid literal, expected "${word}"`);
    }
    const start = this.pos;
    this.pos += word.length;
    return this.builder.literal(value, start, this.pos);
  }

  private skipWhitespace(): void {
    while (isWhitespace(this.text.charCodeAt(this.pos))) this.pos++;
  }

  private describeCurrent(): string {
    const code = this.text.charCodeAt(this.pos);
    if (Number.isNaN(code)) return "end of input";
    if (code >= 0x21 && code <= 0x7e) {
      return `character "${String.fromCharCode(code)}"`;
    }
    return `character U+${code.toString(16).toUpperCase().padStart(4, "0")}`;
  }

  private error(message: string, position = this.pos): JSONParseError {
    return new JSONParseError(message, this.text, position);
  }
}
