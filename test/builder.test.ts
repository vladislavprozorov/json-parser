import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseWith,
  JSONParseError,
  type Builder,
  type NumberValue,
} from "../src/index.ts";

type MapValue =
  | null
  | boolean
  | NumberValue
  | MapValue[]
  | Map<string, MapValue>;

const mapBuilder: Builder<MapValue, MapValue[], Map<string, MapValue>> = {
  literal: (value) => value,
  number: (value) => value,
  string: (value) => value,
  startArray: () => [],
  addElement: (array, value) => {
    array.push(value);
  },
  endArray: (array) => array,
  startObject: () => new Map(),
  hasKey: (object, key) => object.has(key),
  setProperty: (object, key, _keyStart, _keyEnd, value) => {
    object.set(key, value);
  },
  endObject: (object) => object,
};

test("custom builder produces its own representation", () => {
  const result = parseWith('{"a":[1,{"b":null}],"__proto__":true}', mapBuilder);
  assert.deepEqual(
    result,
    new Map<string, MapValue>([
      ["a", [1, new Map([["b", null]])]],
      ["__proto__", true],
    ]),
  );
});

test("parser options apply to custom builders", () => {
  assert.throws(
    () => parseWith('{"a":1,"a":2}', mapBuilder, { duplicateKeys: "error" }),
    JSONParseError,
  );
  assert.deepEqual(
    parseWith('{"a":1,"a":2}', mapBuilder, { duplicateKeys: "first" }),
    new Map([["a", 1]]),
  );
  assert.deepEqual(
    parseWith('{"__proto__":1}', mapBuilder, { protoKey: "ignore" }),
    new Map(),
  );
  assert.equal(
    parseWith("9007199254740993", mapBuilder, { largeIntegers: "bigint" }),
    9007199254740993n,
  );
});

test("builder receives events in document order with spans", () => {
  const events: string[] = [];
  const text = '[1,{"k":"v"},true]';
  const tracer: Builder<string, null, null> = {
    literal: (value, start, end) => log(`literal ${value}`, start, end),
    number: (_value, raw, start, end) => log(`number ${raw}`, start, end),
    string: (value, start, end) => log(`string ${value}`, start, end),
    startArray: (start) => {
      events.push(`[ @${start}`);
      return null;
    },
    addElement: () => {
      events.push("element");
    },
    endArray: (_array, end) => {
      events.push(`] @${end}`);
      return "array";
    },
    startObject: (start) => {
      events.push(`{ @${start}`);
      return null;
    },
    hasKey: () => false,
    setProperty: (_object, key, keyStart, keyEnd) => {
      events.push(`key ${key} ${text.slice(keyStart, keyEnd)}`);
    },
    endObject: (_object, end) => {
      events.push(`} @${end}`);
      return "object";
    },
  };
  function log(event: string, start: number, end: number): string {
    events.push(`${event} ${text.slice(start, end)}`);
    return event;
  }

  assert.equal(parseWith(text, tracer), "array");
  assert.deepEqual(events, [
    "[ @0",
    "number 1 1",
    "element",
    "{ @3",
    'string v "v"',
    'key k "k"',
    "} @12",
    "element",
    "literal true true",
    "element",
    "] @18",
  ]);
});
