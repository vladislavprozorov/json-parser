import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseAst,
  JSONParseError,
  type ValueNode,
} from "../src/index.ts";
import { expectNode, toValue } from "./support/ast.ts";

const span = (node: { start: number; end: number }) => [node.start, node.end];

const at = (line: number, column: number, offset: number) => ({
  line,
  column,
  offset,
});

test("primitive nodes carry type, value and span", () => {
  assert.deepEqual(parseAst("null"), {
    type: "null",
    value: null,
    start: 0,
    end: 4,
    loc: { start: at(1, 1, 0), end: at(1, 5, 4) },
  });
  assert.deepEqual(parseAst(" true "), {
    type: "boolean",
    value: true,
    start: 1,
    end: 5,
    loc: { start: at(1, 2, 1), end: at(1, 6, 5) },
  });
  assert.deepEqual(parseAst("-1.5e3"), {
    type: "number",
    value: -1500,
    raw: "-1.5e3",
    start: 0,
    end: 6,
    loc: { start: at(1, 1, 0), end: at(1, 7, 6) },
  });
  assert.deepEqual(parseAst('"a\\nb"'), {
    type: "string",
    value: "a\nb",
    start: 0,
    end: 6,
    loc: { start: at(1, 1, 0), end: at(1, 7, 6) },
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

test("loc tracks lines and columns across newlines", () => {
  const text = '{\n  "users": [\n    {"email": "a@b.c"}\n  ]\n}';
  const root = expectNode(parseAst(text), "object");
  assert.deepEqual(root.loc, {
    start: at(1, 1, 0),
    end: at(5, 2, text.length),
  });

  const users = root.members[0];
  assert.ok(users);
  assert.deepEqual(users.key.loc.start, at(2, 3, 4));
  assert.deepEqual(users.loc.end, at(4, 4, text.length - 2));

  const list = expectNode(users.value, "array");
  const user = expectNode(list.elements[0], "object");
  const email = user.members[0];
  assert.ok(email);
  assert.deepEqual(email.key.loc.start, at(3, 6, 20));
  assert.deepEqual(email.value.loc, {
    start: at(3, 15, 29),
    end: at(3, 22, 36),
  });
  assert.deepEqual(email.loc, {
    start: email.key.loc.start,
    end: email.value.loc.end,
  });
});

test("loc offsets agree with start and end everywhere", () => {
  const text = '[\n1,\r\n"x",\n\n{"k":\n[true,\nnull]}]';
  const visit = (node: ValueNode): void => {
    assert.equal(node.loc.start.offset, node.start);
    assert.equal(node.loc.end.offset, node.end);
    const before = text.slice(0, node.start);
    assert.equal(node.loc.start.line, before.split("\n").length);
    assert.equal(
      node.loc.start.column,
      node.start - (before.lastIndexOf("\n") + 1) + 1,
    );
    if (node.type === "array") node.elements.forEach(visit);
    if (node.type === "object") {
      for (const member of node.members) {
        assert.equal(member.loc.start.offset, member.start);
        visit(member.key);
        visit(member.value);
      }
    }
  };
  visit(parseAst(text));
});
