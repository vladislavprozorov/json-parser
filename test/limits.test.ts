import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, JSONParseError, DEFAULT_MAX_DEPTH } from "../src/index.ts";

const nested = (depth: number) => "[".repeat(depth) + "]".repeat(depth);

test("maxDepth: default limit", () => {
  assert.doesNotThrow(() => parse(nested(DEFAULT_MAX_DEPTH)));
  assert.throws(
    () => parse(nested(DEFAULT_MAX_DEPTH + 1)),
    (e: unknown) =>
      e instanceof JSONParseError &&
      /Maximum nesting depth/.test(e.message) &&
      e.position === DEFAULT_MAX_DEPTH,
  );
});

test("maxDepth: custom limit counts arrays and objects together", () => {
  const opts = { maxDepth: 2 };
  assert.deepEqual(parse('{"a":[1]}', opts), { a: [1] });
  assert.deepEqual(parse("[[],[],{}]", opts), [[], [], {}]);
  assert.throws(() => parse('{"a":[{}]}', opts), JSONParseError);
  assert.equal(parse("1", { maxDepth: 0 }), 1);
  assert.throws(() => parse("[]", { maxDepth: 0 }), JSONParseError);
});

test("maxDepth: depth resets between siblings", () => {
  const input = `[${Array(100).fill(nested(3)).join(",")}]`;
  assert.doesNotThrow(() => parse(input, { maxDepth: 4 }));
});

test("maxLength", () => {
  assert.deepEqual(parse("[1,2]", { maxLength: 5 }), [1, 2]);
  assert.throws(
    () => parse("[1,2] ", { maxLength: 5 }),
    (e: unknown) =>
      e instanceof JSONParseError && /exceeds maxLength/.test(e.message),
  );
});

test("invalid limit options throw RangeError", () => {
  for (const value of [-1, 1.5, NaN, -Infinity]) {
    assert.throws(() => parse("1", { maxDepth: value }), RangeError);
    assert.throws(() => parse("1", { maxLength: value }), RangeError);
  }
});

test("__proto__: default mode defines own property like JSON.parse", () => {
  const input = '{"__proto__":{"polluted":true},"a":1}';
  const result = parse(input) as Record<string, unknown>;
  assert.equal(Object.getPrototypeOf(result), Object.prototype);
  assert.ok(Object.hasOwn(result, "__proto__"));
  assert.deepEqual(result["__proto__"], { polluted: true });
  assert.equal((result as { polluted?: unknown }).polluted, undefined);
  assert.equal(({} as { polluted?: unknown }).polluted, undefined);
  assert.deepEqual(Object.keys(result), Object.keys(JSON.parse(input)));
});

test("__proto__: escaped key is the same key", () => {
  const result = parse('{"\\u005f_proto__":1}') as Record<string, unknown>;
  assert.equal(Object.getPrototypeOf(result), Object.prototype);
  assert.ok(Object.hasOwn(result, "__proto__"));
});

test("__proto__: ignore mode", () => {
  const result = parse('{"__proto__":{"x":1},"a":1}', { protoKey: "ignore" });
  assert.deepEqual(Object.keys(result as object), ["a"]);
});

test("__proto__: error mode", () => {
  assert.throws(
    () => parse('{"a":1,"__proto__":{}}', { protoKey: "error" }),
    (e: unknown) =>
      e instanceof JSONParseError &&
      /__proto__/.test(e.message) &&
      e.column === 8,
  );
});

test("duplicate keys: last wins by default like JSON.parse", () => {
  const input = '{"a":1,"b":2,"a":3}';
  const result = parse(input);
  assert.deepEqual(result, JSON.parse(input));
  assert.deepEqual(Object.keys(result as object), ["a", "b"]);
});

test("duplicate keys: first mode", () => {
  assert.deepEqual(parse('{"a":1,"b":2,"a":3}', { duplicateKeys: "first" }), {
    a: 1,
    b: 2,
  });
});

test("duplicate keys: error mode", () => {
  const opts = { duplicateKeys: "error" } as const;
  assert.deepEqual(parse('{"a":1,"b":{"a":2}}', opts), { a: 1, b: { a: 2 } });
  assert.throws(
    () => parse('{"a":1,"\\u0061":2}', opts),
    (e: unknown) =>
      e instanceof JSONParseError &&
      /Duplicate key "a"/.test(e.message) &&
      e.column === 8,
  );
});

test("duplicate __proto__ follows duplicate key policy", () => {
  const input = '{"__proto__":1,"__proto__":2}';
  assert.equal((parse(input) as Record<string, unknown>)["__proto__"], 2);
  assert.throws(() => parse(input, { duplicateKeys: "error" }), JSONParseError);
});
