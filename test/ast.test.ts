import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAst, JSONParseError } from "../src/index.ts";
import { expectNode, toValue } from "./support/ast.ts";

const span = (node: { start: number; end: number }) => [node.start, node.end];

test("primitive nodes carry type, value and span", () => {
  assert.deepEqual(parseAst("null"), {
    type: "null",
    value: null,
    start: 0,
    end: 4,
  });
  assert.deepEqual(parseAst(" true "), {
    type: "boolean",
    value: true,
    start: 1,
    end: 5,
  });
  assert.deepEqual(parseAst("-1.5e3"), {
    type: "number",
    value: -1500,
    raw: "-1.5e3",
    start: 0,
    end: 6,
  });
  assert.deepEqual(parseAst('"a\\nb"'), {
    type: "string",
    value: "a\nb",
    start: 0,
    end: 6,
  });
});

test("number node keeps raw text and honours largeIntegers", () => {
  const node = expectNode(
    parseAst("12345678901234567890", { largeIntegers: "bigint" }),
    "number",
  );
  assert.equal(node.value, 12345678901234567890n);
  assert.equal(node.raw, "12345678901234567890");
});

test("array spans cover brackets, elements exclude whitespace", () => {
  const node = expectNode(parseAst("[ 1 , [ ] ]"), "array");
  assert.deepEqual(span(node), [0, 11]);
  assert.deepEqual(node.elements.map(span), [
    [2, 3],
    [6, 9],
  ]);
});

test("member spans run from key start to value end", () => {
  const text = '{ "name" : "x", "list": [1] }';
  const slice = (node: { start: number; end: number }) =>
    text.slice(node.start, node.end);
  const node = expectNode(parseAst(text), "object");
  assert.deepEqual(span(node), [0, text.length]);
  const [name, list] = node.members;
  assert.ok(name && list);
  assert.equal(slice(name), '"name" : "x"');
  assert.equal(slice(name.key), '"name"');
  assert.equal(name.key.value, "name");
  assert.equal(slice(list), '"list": [1]');
  assert.equal(slice(list.value), "[1]");
});

test("duplicate keys: last wins and members stay in source order", () => {
  const node = expectNode(parseAst('{"a":1,"b":2,"a":3}'), "object");
  assert.deepEqual(
    node.members.map((m) => [m.key.value, toValue(m.value)]),
    [
      ["b", 2],
      ["a", 3],
    ],
  );
  const starts = node.members.map((m) => m.start);
  assert.deepEqual(starts, [...starts].sort((x, y) => x - y));
});

test("duplicate keys: first and error modes", () => {
  const text = '{"a":1,"a":2}';
  assert.deepEqual(toValue(parseAst(text, { duplicateKeys: "first" })), {
    a: 1,
  });
  assert.throws(
    () => parseAst(text, { duplicateKeys: "error" }),
    JSONParseError,
  );
});

test("__proto__ is a plain member in the AST", () => {
  const node = expectNode(parseAst('{"__proto__":{"x":1}}'), "object");
  assert.equal(node.members[0]?.key.value, "__proto__");
  const ignored = expectNode(
    parseAst('{"__proto__":1,"a":2}', { protoKey: "ignore" }),
    "object",
  );
  assert.deepEqual(
    ignored.members.map((m) => m.key.value),
    ["a"],
  );
});

test("AST converts back to the same value as JSON.parse", () => {
  const text =
    '{"a":[1,-0,2.5e-3,"s\\u00e9",true,false,null],"b":{"c":{}},"d":[]}';
  assert.deepEqual(toValue(parseAst(text)), JSON.parse(text));
});

test("AST parsing applies the same limits and errors", () => {
  assert.throws(() => parseAst("[1,]"), JSONParseError);
  assert.throws(() => parseAst("[[[]]]", { maxDepth: 2 }), JSONParseError);
});
