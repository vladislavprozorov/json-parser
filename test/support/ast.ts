import assert from "node:assert/strict";
import type { JSONObject, JSONValue, ValueNode } from "../../src/index.ts";

export function expectNode<T extends ValueNode["type"]>(
  node: ValueNode | undefined,
  type: T,
): Extract<ValueNode, { type: T }> {
  assert.ok(node, `expected ${type} node, got undefined`);
  assert.equal(node.type, type);
  return node as Extract<ValueNode, { type: T }>;
}

export function toValue(node: ValueNode): JSONValue {
  switch (node.type) {
    case "null":
    case "boolean":
    case "number":
    case "string":
      return node.value;
    case "array":
      return node.elements.map(toValue);
    case "object": {
      const object: JSONObject = {};
      for (const { key, value } of node.members) {
        Object.defineProperty(object, key.value, {
          value: toValue(value),
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
      return object;
    }
  }
}
