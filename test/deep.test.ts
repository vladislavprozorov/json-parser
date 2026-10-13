import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parse,
  parseAst,
  JSONParseError,
  type JSONObject,
  type JSONValue,
  type ValueNode,
} from "../src/index.ts";

const unlimited = { maxDepth: Infinity };

function arrayDepth(value: JSONValue): number {
  let depth = 0;
  for (let v = value; Array.isArray(v); v = v[0] ?? null) depth++;
  return depth;
}

function assertObject(value: JSONValue): asserts value is JSONObject {
  assert.ok(value !== null && typeof value === "object");
  assert.ok(!Array.isArray(value));
}

function nestedArrays(depth: number): string {
  return "[".repeat(depth) + "]".repeat(depth);
}

test("100 000 nested arrays", () => {
  assert.equal(arrayDepth(parse(nestedArrays(100_000), unlimited)), 100_000);
});

test("1 000 000 nested arrays", () => {
  assert.equal(
    arrayDepth(parse(nestedArrays(1_000_000), unlimited)),
    1_000_000,
  );
});

test("100 000 nested objects keep the innermost value", () => {
  const depth = 100_000;
  const text = '{"a":'.repeat(depth) + "42" + "}".repeat(depth);
  let value = parse(text, unlimited);
  for (let i = 0; i < depth; i++) {
    assertObject(value);
    value = value["a"] ?? null;
  }
  assert.equal(value, 42);
});

test("mixed deep nesting with siblings at every level", () => {
  const depth = 50_000;
  const text = '[1,{"k":'.repeat(depth) + "null" + "},2]".repeat(depth);
  let value = parse(text, unlimited);
  for (let i = 0; i < depth; i++) {
    assert.ok(Array.isArray(value) && value.length === 3);
    assert.equal(value[0], 1);
    assert.equal(value[2], 2);
    const object = value[1] ?? null;
    assertObject(object);
    value = object["k"] ?? null;
  }
  assert.equal(value, null);
});

test("deep AST", () => {
  const depth = 100_000;
  let node: ValueNode | undefined = parseAst(nestedArrays(depth), unlimited);
  let levels = 0;
  while (node?.type === "array") {
    assert.equal(node.start, levels);
    assert.equal(node.end, 2 * depth - levels);
    levels++;
    node = node.elements[0];
  }
  assert.equal(levels, depth);
});

test("deep JSONC and JSON5 with comments and trailing commas", () => {
  const depth = 50_000;
  const text = "[/*c*/".repeat(depth) + "]//c\n,".repeat(depth).slice(0, -1);
  const jsonc = parse(text, { ...unlimited, dialect: "jsonc" });
  assert.equal(arrayDepth(jsonc), depth);
  const json5 = "{a:".repeat(depth) + "0x1" + ",}".repeat(depth);
  assert.doesNotThrow(() => parse(json5, { ...unlimited, dialect: "json5" }));
});

test("errors at the bottom of a deep document", () => {
  const depth = 100_000;
  assert.throws(
    () => parse("[".repeat(depth), unlimited),
    (e: unknown) =>
      e instanceof JSONParseError &&
      e.reason === "Unexpected end of input" &&
      e.path.length === depth,
  );
  assert.throws(
    () => parse(nestedArrays(depth) + "]", unlimited),
    (e: unknown) => e instanceof JSONParseError && e.path.length === 0,
  );
});

test("maxDepth still limits deep input", () => {
  assert.throws(
    () => parse(nestedArrays(100_000)),
    (e: unknown) =>
      e instanceof JSONParseError &&
      /Maximum nesting depth of 1000/.test(e.reason) &&
      e.path.length === 1000,
  );
});
