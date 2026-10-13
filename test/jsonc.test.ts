import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, parseAst, JSONParseError } from "../src/index.ts";

const jsonc = { dialect: "jsonc" } as const;

test("line and block comments anywhere whitespace is allowed", () => {
  const text = `// leading
  /* block
     over lines */
  {
    "a" /* before colon */ : /* after colon */ 1, // after value
    "b": [ /* empty */ ],
    "c": [1 /* between */, 2] // end
  } // trailing
  /* final */`;
  assert.deepEqual(parse(text, jsonc), { a: 1, b: [], c: [1, 2] });
});

test("comment markers inside strings are text", () => {
  assert.deepEqual(parse('{"url": "http://x/*y*/"} // c', jsonc), {
    url: "http://x/*y*/",
  });
});

test("line comment ends at LF or CR", () => {
  assert.deepEqual(parse("[1, // a\r2, // b\n3]", jsonc), [1, 2, 3]);
  assert.equal(parse("1 // no newline at end", jsonc), 1);
});

test("U+2028 and U+2029 do not end a JSONC line comment", () => {
  const ls = String.fromCharCode(0x2028);
  const ps = String.fromCharCode(0x2029);
  const text = `[1, // a${ls} 2, b${ps} 3\n4]`;
  assert.deepEqual(parse(text, jsonc), [1, 4]);
});

test("block comments do not nest", () => {
  assert.throws(() => parse("/* /* */ */ 1", jsonc), JSONParseError);
  assert.equal(parse("/***/ 1 /* ** / */", jsonc), 1);
});

test("trailing commas in arrays and objects", () => {
  assert.deepEqual(parse("[1, 2,]", jsonc), [1, 2]);
  assert.deepEqual(parse('{"a": 1,}', jsonc), { a: 1 });
  assert.deepEqual(parse('[{"a": [1,],},]', jsonc), [{ a: [1] }]);
  assert.deepEqual(parse("[1, /* c */ ]", jsonc), [1]);
  assert.deepEqual(parse("[1, // c\n]", jsonc), [1]);
});

test("rejects what JSONC still forbids", () => {
  const bad = [
    "[,]",
    "{,}",
    "[1,,]",
    "[1,,2]",
    '{"a":1,,}',
    "/* unterminated",
    "/*/ 1",
    "/ 1",
    "1 /",
    "[1] #",
    "{a: 1}",
    "['a']",
    "[0x1]",
  ];
  for (const input of bad) {
    assert.throws(
      () => parse(input, jsonc),
      JSONParseError,
      `should reject: ${input}`,
    );
  }
});

test("errors in comments carry position and path", () => {
  assert.throws(
    () => parse('{\n  "a": [1, /* open\n', jsonc),
    (e: unknown) =>
      e instanceof JSONParseError &&
      e.reason === "Unterminated block comment" &&
      e.line === 2 &&
      e.column === 12 &&
      e.path.join() === "a",
  );
});

test("plain JSON stays strict by default", () => {
  for (const input of ["[1,]", '{"a":1,}', "// c\n1", "1 /* c */"]) {
    assert.throws(() => parse(input), JSONParseError, input);
    assert.doesNotThrow(() => parse(input, jsonc), input);
  }
});

test("AST spans skip comments", () => {
  const text = "/* a */ [ /* b */ 1 /* c */ , ] // d";
  const node = parseAst(text, jsonc);
  assert.equal(node.type, "array");
  assert.equal(text.slice(node.start, node.end), "[ /* b */ 1 /* c */ , ]");
  assert.equal(node.type === "array" && node.elements[0]?.start, 18);
});

test("unknown dialect is rejected", () => {
  assert.throws(
    () => parse("1", { dialect: "yaml" as "json" }),
    RangeError,
  );
});
