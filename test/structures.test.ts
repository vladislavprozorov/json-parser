import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, JSONParseError } from "../src/index.ts";

test("arrays and objects match JSON.parse exactly", () => {
  const cases = [
    "[]",
    "{}",
    "[ ]",
    "{ }",
    "[1]",
    "[1,2,3]",
    ' [ 1 , "a" , true , null , false ] ',
    '{"a":1}',
    '{ "a" : 1 , "b" : [ 2 , 3 ] }',
    '{"":0}',
    '[[],[[]],{}]',
    '{"a":{"b":{"c":[{"d":null}]}}}',
    '[-0, 1e3, "x\\ny"]',
    '{"\\u0061":1,"a\\"b":2}',
    '\n[\r\n\t1\r\n]\n',
  ];
  for (const input of cases) {
    assert.deepEqual(parse(input), JSON.parse(input), `mismatch on ${input}`);
  }
});

test("key order matches JSON.parse", () => {
  const input = '{"b":1,"a":2,"2":3,"1":4}';
  assert.deepEqual(
    Object.keys(parse(input) as object),
    Object.keys(JSON.parse(input)),
  );
});

test("rejects invalid arrays and objects", () => {
  const bad = [
    "[",
    "]",
    "{",
    "}",
    "[1",
    "[1,",
    "[1,]",
    "[,1]",
    "[,]",
    "[1 2]",
    "[1;2]",
    "{\"a\"}",
    "{\"a\":}",
    "{\"a\" 1}",
    "{\"a\":1,}",
    "{,\"a\":1}",
    "{\"a\":1 \"b\":2}",
    "{a:1}",
    "{'a':1}",
    "{1:1}",
    "{null:1}",
    "[1]]",
    "{}}",
    "[}",
    "{]",
    "[1]x",
  ];
  for (const input of bad) {
    assert.throws(
      () => parse(input),
      JSONParseError,
      `should reject: ${input}`,
    );
  }
});

test("error messages point at the offending character", () => {
  assert.throws(
    () => parse("[1 2]"),
    (e: unknown) =>
      e instanceof JSONParseError &&
      /Expected "," or "\]"/.test(e.message) &&
      e.column === 4,
  );
  assert.throws(
    () => parse('{\n  "a": 1,\n  b: 2\n}'),
    (e: unknown) =>
      e instanceof JSONParseError &&
      /Expected string key/.test(e.message) &&
      e.line === 3 &&
      e.column === 3,
  );
  assert.throws(
    () => parse('{"a" 1}'),
    (e: unknown) => e instanceof JSONParseError && /Expected ":"/.test(e.message),
  );
});
