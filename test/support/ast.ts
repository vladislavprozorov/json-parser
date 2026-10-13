import type { JSONObject, JSONValue, ValueNode } from "../../src/index.ts";

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
