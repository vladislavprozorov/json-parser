import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, parseAst, JSONParseError } from "../src/index.ts";
import { expectNode } from "./support/ast.ts";

const json5 = { dialect: "json5" } as const;
const bs = String.fromCharCode(0x5c);

function rejects(inputs: string[]): void {
  for (const input of inputs) {
    assert.throws(
      () => parse(input, json5),
      JSONParseError,
      `should reject: ${JSON.stringify(input)}`,
    );
  }
}

test("numbers", () => {
  const cases: [string, number][] = [
    ["0x1F", 31],
    ["0XdeadBEEF", 0xdeadbeef],
    ["-0x10", -16],
    ["+0x10", 16],
    [".5", 0.5],
    ["5.", 5],
    ["-.5e1", -5],
    ["5.e2", 500],
    ["+1", 1],
    ["+1.5e-1", 0.15],
    ["Infinity", Infinity],
    ["-Infinity", -Infinity],
    ["+Infinity", Infinity],
  ];
  for (const [input, expected] of cases) {
    assert.equal(parse(input, json5), expected, input);
  }
  assert.ok(Number.isNaN(parse("NaN", json5)));
  assert.ok(Number.isNaN(parse("-NaN", json5)));
  assert.ok(Object.is(parse("-0x0", json5), -0));
});

test("invalid numbers", () => {
  rejects(["0x", "0xG", "01", "-01", ".", "+.", "+", "-", "++1", "+-1"]);
  rejects(["1e", ".e1", "Inf", "infinity", "nan", "0b1", "0o7", "1_000"]);
});

test("large hex integers honour largeIntegers", () => {
  const text = "-0x20000000000001";
  assert.equal(parse(text, json5), -9007199254740992);
  assert.equal(
    parse(text, { ...json5, largeIntegers: "bigint" }),
    -9007199254740993n,
  );
  assert.equal(parse(text, { ...json5, largeIntegers: "string" }), text);
});

test("number nodes keep the original notation", () => {
  const node = expectNode(parseAst("[0xFF, .5, +Infinity]", json5), "array");
  assert.deepEqual(
    node.elements.map((element) => expectNode(element, "number").raw),
    ["0xFF", ".5", "+Infinity"],
  );
});

test("single quoted strings", () => {
  assert.equal(parse("'abc'", json5), "abc");
  assert.equal(parse(`'say "hi"'`, json5), 'say "hi"');
  assert.equal(parse(`"it's"`, json5), "it's");
  assert.equal(parse(`'it${bs}'s'`, json5), "it's");
  assert.equal(parse(`"${bs}'"`, json5), "'");
});

test("extra escapes", () => {
  const cases: [string, string][] = [
    [`'${bs}v'`, String.fromCharCode(0x0b)],
    [`'${bs}0'`, String.fromCharCode(0)],
    [`'${bs}x41${bs}x6a'`, "Aj"],
    [`'${bs}a${bs}c${bs}%'`, "ac%"],
    [`'a${bs}\nb'`, "ab"],
    [`'a${bs}\r\nb'`, "ab"],
    [`'a${bs}\rb'`, "ab"],
    [`'a${bs}${String.fromCharCode(0x2028)}b'`, "ab"],
    [`'${bs}u0041'`, "A"],
  ];
  for (const [input, expected] of cases) {
    assert.equal(parse(input, json5), expected, JSON.stringify(input));
  }
});

test("invalid escapes and raw line breaks", () => {
  rejects([
    `'${bs}1'`,
    `'${bs}01'`,
    `'${bs}x4'`,
    `'${bs}xZZ'`,
    `'${bs}u12'`,
    "'a\nb'",
    "'a\rb'",
    "'abc",
    `'abc${bs}`,
    `'abc"`,
  ]);
});

test("raw control characters other than line breaks are allowed", () => {
  assert.equal(parse("'a\tb'", json5), "a\tb");
  assert.equal(parse(`'a${String.fromCharCode(1)}b'`, json5), "a\u0001b");
});

test("identifier keys", () => {
  assert.deepEqual(
    parse("{ a: 1, $b: 2, _c: 3, d4: 4, null: 5, true: 6, if: 7 }", json5),
    { a: 1, $b: 2, _c: 3, d4: 4, null: 5, true: 6, if: 7 },
  );
  assert.deepEqual(parse("{ ümlåût: 1, 名前: 2 }", json5), {
    ümlåût: 1,
    名前: 2,
  });
  assert.deepEqual(parse(`{ ${bs}u0061b: 1 }`, json5), { ab: 1 });
  assert.deepEqual(parse("{ 'quoted': 1, \"double\": 2 }", json5), {
    quoted: 1,
    double: 2,
  });
});

test("invalid identifier keys", () => {
  rejects([
    "{ 1a: 1 }",
    "{ a-b: 1 }",
    "{ a b: 1 }",
    "{ -a: 1 }",
    `{ ${bs}x61: 1 }`,
    `{ ${bs}u0031: 1 }`,
    "{ a: }",
    "{ : 1 }",
  ]);
});

test("identifier keys go through key policies and paths", () => {
  assert.throws(
    () => parse("{ a: 1, 'a': 2 }", { ...json5, duplicateKeys: "error" }),
    JSONParseError,
  );
  const safe = parse("{ __proto__: { x: 1 } }", json5) as Record<
    string,
    unknown
  >;
  assert.equal(Object.getPrototypeOf(safe), Object.prototype);
  assert.ok(Object.hasOwn(safe, "__proto__"));
  assert.throws(
    () => parse("{ users: [ { email: oops } ] }", json5),
    (e: unknown) =>
      e instanceof JSONParseError && e.path.join() === "users,0,email",
  );
});

test("identifier key spans in the AST", () => {
  const text = "{ name: 1 }";
  const node = expectNode(parseAst(text, json5), "object");
  const key = node.members[0]?.key;
  assert.ok(key);
  assert.equal(text.slice(key.start, key.end), "name");
  assert.equal(key.value, "name");
});

test("extra whitespace", () => {
  const spaces = [0x0b, 0x0c, 0xa0, 0x2028, 0x2029, 0xfeff, 0x3000, 0x2003];
  const ws = String.fromCharCode(...spaces);
  assert.deepEqual(parse(`${ws}[${ws}1${ws},${ws}2${ws}]${ws}`, json5), [1, 2]);
});

test("comments end at unicode line terminators", () => {
  const ls = String.fromCharCode(0x2028);
  assert.deepEqual(parse(`[1, // c${ls}2]`, json5), [1, 2]);
});

test("JSON5 is a superset of JSONC", () => {
  assert.deepEqual(parse("/* c */ [1, 2,] // c", json5), [1, 2]);
});

test("strict JSON and JSONC reject JSON5 features", () => {
  const features = [
    "0x1",
    ".5",
    "5.",
    "+1",
    "Infinity",
    "NaN",
    "'a'",
    "{a: 1}",
    `"${bs}x41"`,
    `"${bs}v"`,
    "\u000b1",
  ];
  for (const input of features) {
    assert.doesNotThrow(() => parse(input, json5), input);
    assert.throws(() => parse(input), JSONParseError, input);
    assert.throws(() => parse(input, { dialect: "jsonc" }), JSONParseError);
  }
});
