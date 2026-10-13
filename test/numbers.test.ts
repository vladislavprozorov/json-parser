import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, JSONParseError } from "../src/index.ts";

test("valid numbers match JSON.parse exactly", () => {
  const cases = [
    "0",
    "-0",
    "1",
    "-1",
    "123",
    "1.5",
    "-1.5",
    "0.1",
    "0.0001",
    "1e10",
    "1E10",
    "1e+10",
    "1e-10",
    "-1.25e-3",
    "0e0",
    "0.0e-0",
    "1.7976931348623157e308", // Number.MAX_VALUE
    "5e-324", // минимальное денормализованное
    "1e400",
    "-1e400", // переполнение → ±Infinity, как у JSON.parse
    "123456789012345678901234567890",
  ];
  for (const input of cases) {
    // Object.is, а не equal: отличает -0 от 0
    assert.ok(
      Object.is(parse(input), JSON.parse(input)),
      `mismatch on ${input}`,
    );
  }
});

test("rejects invalid numbers", () => {
  const bad = [
    "-",
    "01",
    "-01",
    "00",
    "1.",
    ".5",
    "+1",
    "1e",
    "1e+",
    "1.e5",
    "0x1F",
    "NaN",
    "Infinity",
    "-Infinity",
    "1_000",
    "- 1",
    "1.5.5",
    "1e5e5",
  ];
  for (const input of bad) {
    assert.throws(
      () => parse(input),
      JSONParseError,
      `should reject: ${input}`,
    );
  }
});

test("error points at the offending character", () => {
  assert.throws(
    () => parse("01"),
    (e: unknown) =>
      e instanceof JSONParseError &&
      /Leading zeros/.test(e.message) &&
      e.column === 2,
  );
});

test("large integers: default mode loses precision like JSON.parse", () => {
  assert.equal(parse("9007199254740993"), 9007199254740992);
});

test("large integers: bigint mode", () => {
  const opts = { largeIntegers: "bigint" } as const;
  assert.equal(parse("9007199254740993", opts), 9007199254740993n);
  assert.equal(parse("-9007199254740993", opts), -9007199254740993n);
  assert.equal(parse("9007199254740991", opts), 9007199254740991); // safe → number
  assert.equal(typeof parse("9007199254740993.0", opts), "number"); // не целое по записи
});

test("large integers: string mode", () => {
  assert.equal(
    parse("12345678901234567890", { largeIntegers: "string" }),
    "12345678901234567890",
  );
});
