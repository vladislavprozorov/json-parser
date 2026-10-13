import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import {
  parse,
  parseAst,
  JSONParseError,
  type JSONValue,
} from "../src/index.ts";
import { toValue } from "./support/ast.ts";

const dir = new URL("../vendor/JSONTestSuite/test_parsing/", import.meta.url);

if (!existsSync(dir)) {
  throw new Error(
    "JSONTestSuite not found, run: git submodule update --init --depth 1",
  );
}

const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
const strictUtf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const lenientUtf8 = new TextDecoder("utf-8", { ignoreBOM: true });

function read(name: string): Buffer {
  return readFileSync(new URL(name, dir));
}

type Outcome = { ok: true; value: JSONValue } | { ok: false };

function outcome(fn: () => JSONValue): Outcome {
  try {
    return { ok: true, value: fn() };
  } catch {
    return { ok: false };
  }
}

describe("JSONTestSuite: y_ must be accepted", () => {
  for (const name of files.filter((f) => f.startsWith("y_"))) {
    test(name, () => {
      const text = strictUtf8.decode(read(name));
      const expected = JSON.parse(text);
      assert.deepEqual(parse(text), expected);
      assert.deepEqual(toValue(parseAst(text)), expected);
    });
  }
});

describe("JSONTestSuite: n_ must be rejected", () => {
  for (const name of files.filter((f) => f.startsWith("n_"))) {
    test(name, () => {
      let text: string;
      try {
        text = strictUtf8.decode(read(name));
      } catch {
        return;
      }
      assert.throws(() => parse(text), JSONParseError);
      assert.throws(() => parseAst(text), JSONParseError);
    });
  }
});

describe("JSONTestSuite: i_ behaves like JSON.parse", () => {
  for (const name of files.filter((f) => f.startsWith("i_"))) {
    test(name, () => {
      const text = lenientUtf8.decode(read(name));
      const ours = outcome(() => parse(text));
      const native = outcome(() => JSON.parse(text));
      assert.deepEqual(ours, native);
      if (!ours.ok) {
        assert.throws(() => parse(text), JSONParseError);
      }
    });
  }
});

test("JSONTestSuite: all categories are present", () => {
  for (const prefix of ["y_", "n_", "i_"]) {
    assert.ok(files.some((f) => f.startsWith(prefix)), `no ${prefix} files`);
  }
});
