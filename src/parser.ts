import type { Builder } from "./builders/builder.ts";
import type { ResolvedOptions } from "./options.ts";
import { JSONParseError, ParseFailure } from "./errors.ts";
import type { PathSegment } from "./path.ts";
import {
  CH_COLON,
  CH_COMMA,
  CH_RBRACE,
  CH_RBRACKET,
  CH_SLASH,
  isJson5Whitespace,
  isWhitespace,
} from "./scanner/chars.ts";
import { scanComment } from "./scanner/comment.ts";
import { isIdentifierStart, scanIdentifier } from "./scanner/identifier.ts";
import {
  numberValue,
  scanJson5Number,
  scanNumber,
} from "./scanner/number.ts";
import {
  isStringStart,
  scanString,
  type ScannedString,
  type StringSyntax,
} from "./scanner/string.ts";

export class Parser<Value, ArrayState, ObjectState> {
  private readonly text: string;
  private readonly builder: Builder<Value, ArrayState, ObjectState>;
  private readonly options: ResolvedOptions;
  private readonly json5: boolean;
  private readonly stringSyntax: StringSyntax;
  private pos = 0;
  private depth = 0;
  private readonly path: PathSegment[] = [];

  constructor(
    text: string,
    builder: Builder<Value, ArrayState, ObjectState>,
    options: ResolvedOptions,
  ) {
    this.text = text;
    this.builder = builder;
    this.options = options;
    this.json5 = options.syntax.json5;
    this.stringSyntax = {
      json5: this.json5,
      loneSurrogates: options.loneSurrogates,
    };
  }

  parse(): Value {
    try {
      return this.parseDocument();
    } catch (error) {
      if (error instanceof ParseFailure) {
        throw new JSONParseError(
          error.message,
          this.text,
          error.position,
          this.path.slice(),
        );
      }
      throw error;
    }
  }

  private parseDocument(): Value {
    if (this.text.length > this.options.maxLength) {
      throw this.fail(
        `Input length ${this.text.length} exceeds maxLength of ${this.options.maxLength}`,
        this.options.maxLength,
      );
    }
    this.skipWhitespace();
    const value = this.parseValue();
    this.skipWhitespace();
    if (this.pos < this.text.length) {
      throw this.fail(`Unexpected ${this.describeCurrent()} after JSON value`);
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
      case "'":
        return this.json5 ? this.parseString() : this.unexpected();
      case "+":
      case ".":
      case "I":
      case "N":
        return this.json5 ? this.parseNumber() : this.unexpected();
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
        throw this.fail("Unexpected end of input");
      default:
        return this.unexpected();
    }
  }

  private unexpected(): never {
    throw this.fail(`Unexpected ${this.describeCurrent()}`);
  }

  private parseArray(): Value {
    const array = this.builder.startArray(this.enter());
    this.skipWhitespace();
    if (this.text.charCodeAt(this.pos) === CH_RBRACKET) {
      return this.builder.endArray(array, this.leave());
    }
    for (let index = 0; ; index++) {
      this.skipWhitespace();
      this.path.push(index);
      this.builder.addElement(array, this.parseValue());
      this.path.pop();
      this.skipWhitespace();
      const c = this.text.charCodeAt(this.pos);
      if (c === CH_COMMA) {
        this.pos++;
        if (this.closesAfterComma(CH_RBRACKET)) {
          return this.builder.endArray(array, this.leave());
        }
      } else if (c === CH_RBRACKET) {
        return this.builder.endArray(array, this.leave());
      } else {
        throw this.fail(
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
      const keyStart = this.pos;
      const key = this.scanKey();
      this.path.push(key.value);
      const accepted = this.acceptKey(object, key.value, keyStart);
      this.skipWhitespace();
      if (this.text.charCodeAt(this.pos) !== CH_COLON) {
        throw this.fail(
          `Expected ":" after object key, got ${this.describeCurrent()}`,
        );
      }
      this.pos++;
      this.skipWhitespace();
      const value = this.parseValue();
      this.path.pop();
      if (accepted) {
        this.builder.setProperty(object, key.value, keyStart, key.end, value);
      }
      this.skipWhitespace();
      const c = this.text.charCodeAt(this.pos);
      if (c === CH_COMMA) {
        this.pos++;
        if (this.closesAfterComma(CH_RBRACE)) {
          return this.builder.endObject(object, this.leave());
        }
      } else if (c === CH_RBRACE) {
        return this.builder.endObject(object, this.leave());
      } else {
        throw this.fail(
          `Expected "," or "}" in object, got ${this.describeCurrent()}`,
        );
      }
    }
  }

  private acceptKey(
    object: ObjectState,
    key: string,
    keyStart: number,
  ): boolean {
    if (key === "__proto__") {
      switch (this.options.protoKey) {
        case "ignore":
          return false;
        case "error":
          throw this.fail('Forbidden key "__proto__"', keyStart);
      }
    }
    if (this.builder.hasKey(object, key)) {
      switch (this.options.duplicateKeys) {
        case "first":
          return false;
        case "error":
          throw this.fail(`Duplicate key ${JSON.stringify(key)}`, keyStart);
      }
    }
    return true;
  }

  private closesAfterComma(close: number): boolean {
    if (!this.options.syntax.trailingCommas) return false;
    this.skipWhitespace();
    return this.text.charCodeAt(this.pos) === close;
  }

  private enter(): number {
    if (this.depth >= this.options.maxDepth) {
      throw this.fail(
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

  private scanKey(): ScannedString {
    const { text, pos } = this;
    if (isStringStart(text.charCodeAt(pos), this.stringSyntax)) {
      return this.scanString();
    }
    if (!this.json5 || !isIdentifierStart(text, pos)) {
      const expected = this.json5 ? "string or identifier key" : "string key";
      throw this.fail(
        `Expected ${expected} in object, got ${this.describeCurrent()}`,
      );
    }
    const scanned = scanIdentifier(text, pos);
    this.pos = scanned.end;
    return scanned;
  }

  private scanString(): ScannedString {
    const scanned = scanString(this.text, this.pos, this.stringSyntax);
    this.pos = scanned.end;
    return scanned;
  }

  private parseNumber(): Value {
    const start = this.pos;
    const scanned = this.json5
      ? scanJson5Number(this.text, start)
      : scanNumber(this.text, start);
    const { end } = scanned;
    this.pos = end;
    const raw = this.text.slice(start, end);
    const value = numberValue(raw, scanned, this.options.largeIntegers);
    return this.builder.number(value, raw, start, end);
  }

  private parseLiteral(word: string, value: boolean | null): Value {
    if (!this.text.startsWith(word, this.pos)) {
      throw this.fail(`Invalid literal, expected "${word}"`);
    }
    const start = this.pos;
    this.pos += word.length;
    return this.builder.literal(value, start, this.pos);
  }

  private skipWhitespace(): void {
    const { text } = this;
    const { comments, json5 } = this.options.syntax;
    for (;;) {
      const c = text.charCodeAt(this.pos);
      if (isWhitespace(c) || (json5 && isJson5Whitespace(c))) {
        this.pos++;
      } else if (c === CH_SLASH && comments) {
        this.pos = scanComment(text, this.pos, json5);
      } else {
        return;
      }
    }
  }

  private describeCurrent(): string {
    const code = this.text.charCodeAt(this.pos);
    if (Number.isNaN(code)) return "end of input";
    if (code >= 0x21 && code <= 0x7e) {
      return `character "${String.fromCharCode(code)}"`;
    }
    return `character U+${code.toString(16).toUpperCase().padStart(4, "0")}`;
  }

  private fail(message: string, position = this.pos): ParseFailure {
    return new ParseFailure(message, position);
  }
}
