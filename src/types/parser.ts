import type { JSONValue } from "./types.ts";
import { JSONParseError } from "./errors.ts";

export class Parser {
  private readonly text: string;
  private pos = 0;

  constructor(text: string) {
    this.text = text;
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
      // сюда добавим: '"' → строка, '[' → массив, '{' → объект, '-'/цифра → число
      case undefined:
        throw this.error("Unexpected end of input");
      default:
        throw this.error(`Unexpected ${this.describeCurrent()}`);
    }
  }

  private parseLiteral<T extends JSONValue>(word: string, value: T): T {
    if (this.text.startsWith(word, this.pos)) {
      this.pos += word.length;
      return value;
    }
    throw this.error(`Invalid literal, expected "${word}"`);
  }

  private skipWhitespace(): void {
    while (this.pos < this.text.length) {
      const c = this.text.charCodeAt(this.pos);
      if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) {
        this.pos++;
      } else {
        break;
      }
    }
  }

  private describeCurrent(): string {
    const ch = this.text[this.pos];
    return ch === undefined ? "end of input" : `character "${ch}"`;
  }

  private error(message: string): JSONParseError {
    return new JSONParseError(message, this.text, this.pos);
  }
}
