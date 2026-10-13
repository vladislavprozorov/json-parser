import type { JSONArray, JSONObject, JSONValue } from "../types.ts";
import type { Builder } from "./builder.ts";

export const valueBuilder: Builder<JSONValue, JSONArray, JSONObject> = {
  literal: (value) => value,
  number: (value) => value,
  string: (value) => value,

  startArray: () => [],
  addElement: (array, value) => {
    array.push(value);
  },
  endArray: (array) => array,

  startObject: () => ({}),
  hasKey: (object, key) => Object.hasOwn(object, key),
  setProperty: (object, key, _keyStart, _keyEnd, value) => {
    if (key === "__proto__") {
      Object.defineProperty(object, key, {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    } else {
      object[key] = value;
    }
  },
  endObject: (object) => object,
};
