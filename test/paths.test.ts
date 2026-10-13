import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parse,
  parseAst,
  formatPath,
  JSONParseError,
  type ParseOptions,
  type PathSegment,
} from "../src/index.ts";

function failure(text: string, options?: ParseOptions): JSONParseError {
  try {
    parse(text, options);
  } catch (error) {
    assert.ok(error instanceof JSONParseError);
    return error;
  }
  assert.fail(`should reject: ${text}`);
}

function assertPath(
  text: string,
  path: PathSegment[],
  options?: ParseOptions,
): void {
  assert.deepEqual(failure(text, options).path, path, text);
}

test("formatPath", () => {
  assert.equal(formatPath([]), "$");
  assert.equal(formatPath(["users", 3, "email"]), "$.users[3].email");
  assert.equal(formatPath(["_a", "$b", "c1"]), "$._a.$b.c1");
  assert.equal(formatPath(["a b", "0", "", "1x"]), '$["a b"]["0"][""]["1x"]');
  assert.equal(formatPath(['q"t', "a\nb"]), '$["q\\"t"]["a\\nb"]');
  assert.equal(formatPath([0, 1, 2]), "$[0][1][2]");
});

test("error message includes the path", () => {
  const text = '{"users":[{"email":"a"},{"email":"b","active":tru}]}';
  const error = failure(text);
  assert.deepEqual(error.path, ["users", 1, "active"]);
  assert.equal(error.reason, 'Invalid literal, expected "true"');
  assert.match(error.message, /at \$\.users\[1\]\.active, line 1, column 47/);
});

test("scanner errors get the path of the value being scanned", () => {
  assertPath('{"users":[1,2,3,{"email":"bad\\x"}]}', ["users", 3, "email"]);
  assertPath('[0, {"n": 01}]', [1, "n"]);
  assertPath('{"s": "\\uD800", "t": 1}', ["s"], { loneSurrogates: "error" });
  assertPath('{"a": "unterminated', ["a"]);
});

test("errors in a key point at the enclosing object", () => {
  assertPath('{"a":{"b\\x":1}}', ["a"]);
  assertPath('{"a":{b:1}}', ["a"]);
  assertPath('{"a":{"b" 1}}', ["a", "b"]);
});

test("errors between elements point at the container", () => {
  assertPath("[1,2", []);
  assertPath('{"a":[1 2]}', ["a"]);
  assertPath('{"a":{"b":1 "c":2}}', ["a"]);
  assertPath('{"a":[1,]}', ["a", 1]);
});

test("policy errors point at the offending key", () => {
  assertPath('{"a":{"k":1,"k":2}}', ["a", "k"], { duplicateKeys: "error" });
  assertPath('[{"__proto__":{}}]', [0, "__proto__"], { protoKey: "error" });
});

test("depth errors point at the container that is too deep", () => {
  assertPath('{"a":[[[]]]}', ["a", 0], { maxDepth: 2 });
});

test("root and document level errors have the root path", () => {
  assertPath("x", []);
  assertPath("1 2", []);
  assertPath("", []);
  assertPath("[1]", [], { maxLength: 2 });
  assert.match(failure("x").message, /at \$, line 1, column 1/);
});

test("unusual keys appear verbatim in the path", () => {
  const error = failure('{"a b":{"0":[{"\\u0024x":nul}]}}');
  assert.deepEqual(error.path, ["a b", "0", 0, "$x"]);
  assert.match(error.message, /\$\["a b"\]\["0"\]\[0\]\.\$x/);
});

test("parseAst reports the same path", () => {
  const text = '{"list":[{"x":[1,2,oops]}]}';
  assert.throws(
    () => parseAst(text),
    (e: unknown) =>
      e instanceof JSONParseError &&
      formatPath(e.path) === "$.list[0].x[2]",
  );
});

test("path state does not leak between parses", () => {
  assertPath('{"a":[1,{"b":x}]}', ["a", 1, "b"]);
  assertPath("y", []);
});

test("non-syntax errors are not wrapped", () => {
  const deep = "[".repeat(200_000) + "]".repeat(200_000);
  assert.throws(
    () => parse(deep, { maxDepth: Infinity }),
    (e: unknown) => e instanceof RangeError && !(e instanceof JSONParseError),
  );
});
