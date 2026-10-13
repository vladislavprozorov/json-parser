import { test } from "node:test";
import assert from "node:assert/strict";
import { LineIndex } from "../src/index.ts";

const at = (line: number, column: number, offset: number) => ({
  line,
  column,
  offset,
});

test("positions on a single line", () => {
  const lines = new LineIndex("abc");
  assert.deepEqual(lines.position(0), at(1, 1, 0));
  assert.deepEqual(lines.position(2), at(1, 3, 2));
  assert.deepEqual(lines.position(3), at(1, 4, 3));
});

test("positions around line breaks", () => {
  const lines = new LineIndex("ab\ncd\n\nx");
  assert.deepEqual(lines.position(2), at(1, 3, 2));
  assert.deepEqual(lines.position(3), at(2, 1, 3));
  assert.deepEqual(lines.position(5), at(2, 3, 5));
  assert.deepEqual(lines.position(6), at(3, 1, 6));
  assert.deepEqual(lines.position(7), at(4, 1, 7));
  assert.deepEqual(lines.position(8), at(4, 2, 8));
});

test("CRLF counts as one line break", () => {
  const lines = new LineIndex("a\r\nb");
  assert.deepEqual(lines.position(1), at(1, 2, 1));
  assert.deepEqual(lines.position(3), at(2, 1, 3));
});

test("lookups in any order give the same answers", () => {
  const text = Array.from({ length: 50 }, (_, i) => "x".repeat(i)).join("\n");
  const lines = new LineIndex(text);
  const offsets = Array.from({ length: text.length + 1 }, (_, i) => i);
  const forward = offsets.map((o) => lines.position(o));
  const scramble = (n: number) => (n * 7919) % 101;
  const shuffled = [...offsets].sort((a, b) => scramble(a) - scramble(b));
  for (const offset of shuffled) {
    assert.deepEqual(lines.position(offset), forward[offset]);
  }
  for (const offset of offsets) {
    const before = text.slice(0, offset);
    assert.deepEqual(forward[offset], {
      line: before.split("\n").length,
      column: offset - (before.lastIndexOf("\n") + 1) + 1,
      offset,
    });
  }
});
