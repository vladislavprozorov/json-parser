import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, JSONParseError } from "../src/index.ts";

test("valid strings match JSON.parse exactly", () => {
  const cases = [
    '""',
    '"hello"',
    '"привет, мир"',
    '"😀"',
    '"\\"\\\\\\/\\b\\f\\n\\r\\t"',
    '"a\\nb\\tc"',
    '"\\u0041\\u00e9\\u00E9"',
    '"\\u0000"',
    '"\\u001f"',
    '"\\uD83D\\uDE00"', // суррогатная пара → 😀
    '"\\ud83d\\ude00"',
    '"\u007f"', // DEL не управляющий для JSON
    '"text \\u0041 text"',
  ];
  for (const input of cases) {
    assert.equal(parse(input), JSON.parse(input), `mismatch on ${input}`);
  }
});

test("surrogate pair decodes to one code point", () => {
  const s = parse('"\\uD83D\\uDE00"') as string;
  assert.equal(s.codePointAt(0), 0x1f600);
  assert.equal([...s].length, 1);
});

test("rejects invalid strings", () => {
  const bad = [
    '"',
    '"abc',
    '"abc\\',
    '"abc\\"',
    "'abc'",
    '"\\x41"',
    '"\\a"',
    '"\\U0041"',
    '"\\u"',
    '"\\u12"',
    '"\\u12G4"',
    '"\\u{41}"',
    '"a\nb"', // сырой перевод строки
    '"a\tb"',
    '"\u0000"',
    '"\u001f"',
  ];
  for (const input of bad) {
    assert.throws(
      () => parse(input),
      JSONParseError,
      `should reject: ${JSON.stringify(input)}`,
    );
  }
});

test("error points at the offending character", () => {
  assert.throws(
    () => parse('"ab\\x"'),
    (e: unknown) =>
      e instanceof JSONParseError &&
      /Invalid escape/.test(e.message) &&
      e.column === 5,
  );
  assert.throws(
    () => parse('"\\u12Z4"'),
    (e: unknown) =>
      e instanceof JSONParseError && /hex/.test(e.message) && e.column === 6,
  );
  assert.throws(
    () => parse('"abc'),
    (e: unknown) =>
      e instanceof JSONParseError && /Unterminated/.test(e.message),
  );
});

test("lone surrogates: default mode keeps them like JSON.parse", () => {
  const cases = [
    '"\\uD800"',
    '"\\uDC00"',
    '"\\uDE00\\uD83D"', // пара в обратном порядке
    '"\\uD83Dx"',
    '"\\uD83D\\u0041"',
    '"\\uD800\\uD800\\uDC00"',
  ];
  for (const input of cases) {
    assert.equal(parse(input), JSON.parse(input), `mismatch on ${input}`);
  }
});

test("lone surrogates: replace mode", () => {
  const opts = { loneSurrogates: "replace" } as const;
  assert.equal(parse('"\\uD800"', opts), "�");
  assert.equal(parse('"a\\uDC00b"', opts), "a�b");
  assert.equal(parse('"\\uD83D\\u0041"', opts), "�A");
  assert.equal(parse('"\\uD800\\uD83D\\uDE00"', opts), "�😀");
  assert.equal(parse('"\\uD83D\\uDE00"', opts), "😀"); // пара не трогается
});

test("lone surrogates: error mode", () => {
  const opts = { loneSurrogates: "error" } as const;
  assert.equal(parse('"\\uD83D\\uDE00"', opts), "😀");
  assert.throws(
    () => parse('"ab\\uDC00"', opts),
    (e: unknown) =>
      e instanceof JSONParseError &&
      /Lone surrogate/.test(e.message) &&
      e.column === 4,
  );
  assert.throws(() => parse('"\\uD800"', opts), JSONParseError);
});

test("rejects trailing content after string", () => {
  assert.throws(() => parse('"a" "b"'), JSONParseError);
  assert.equal(parse(' \n "a" \t'), "a");
});
