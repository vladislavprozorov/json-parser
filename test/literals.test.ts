import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, JSONParseError } from "../src/index.ts";

test("parses literals", () => {
  assert.equal(parse("true"), true);
  assert.equal(parse("false"), false);
  assert.equal(parse("null"), null);
});

test("skips surrounding whitespace", () => {
  assert.equal(parse(" \t\r\n true \n"), true);
});

test("rejects invalid input", () => {
  const bad = [
    "",
    "   ",
    "tru",
    "True",
    "truex",
    "nul l",
    "true false",
    "\vtrue",
  ];
  for (const input of bad) {
    assert.throws(
      () => parse(input),
      JSONParseError,
      `should reject: ${JSON.stringify(input)}`,
    );
  }
});

test("reports line and column", () => {
  try {
    parse("\n\n  nope");
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e instanceof JSONParseError);
    assert.equal(e.line, 3);
    assert.equal(e.column, 3);
  }
});
