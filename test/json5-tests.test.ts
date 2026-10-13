import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname } from "node:path";
import { parse, JSONParseError, type JSONValue } from "../src/index.ts";

const dir = new URL("../vendor/json5-tests/", import.meta.url);

if (!existsSync(dir)) {
  throw new Error(
    "json5-tests not found, run: git submodule update --init --depth 1",
  );
}

const json5 = { dialect: "json5" } as const;

const files = readdirSync(dir, { recursive: true, encoding: "utf8" })
  .filter((name) => !name.startsWith(".git"))
  .sort();

const byExtension = (extension: string) =>
  files.filter((name) => extname(name) === extension);

function read(name: string): string {
  return readFileSync(new URL(name, dir), "utf8");
}

function evaluate(text: string): JSONValue {
  return new Function(`"use strict"; return (\n${text}\n);`)();
}

function expectedJson(text: string): JSONValue {
  try {
    return JSON.parse(text);
  } catch {
    return evaluate(text);
  }
}

describe("json5-tests: .json is valid JSON5 with the same value", () => {
  for (const name of byExtension(".json")) {
    test(name, () => {
      const text = read(name);
      assert.deepEqual(parse(text, json5), expectedJson(text));
    });
  }
});

describe("json5-tests: .json5 is valid JSON5 with the ES5 value", () => {
  for (const name of byExtension(".json5")) {
    test(name, () => {
      const text = read(name);
      assert.deepEqual(parse(text, json5), evaluate(text));
    });
  }
});

describe("json5-tests: .js and .txt must be rejected", () => {
  for (const name of [...byExtension(".js"), ...byExtension(".txt")]) {
    test(name, () => {
      assert.throws(() => parse(read(name), json5), JSONParseError);
    });
  }
});

test("json5-tests: all categories are present", () => {
  for (const extension of [".json", ".json5", ".js", ".txt"]) {
    assert.ok(byExtension(extension).length > 0, `no ${extension} files`);
  }
});
