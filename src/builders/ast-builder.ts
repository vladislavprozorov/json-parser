import type { ArrayNode, MemberNode, ObjectNode, ValueNode } from "../ast.ts";
import { LineIndex, type SourceLocation } from "../location.ts";
import type { Builder } from "./builder.ts";

interface ArrayState {
  readonly start: number;
  readonly elements: ValueNode[];
}

interface ObjectState {
  readonly start: number;
  readonly members: MemberNode[];
  readonly byKey: Map<string, MemberNode>;
}

export type AstBuilder = Builder<ValueNode, ArrayState, ObjectState>;

export function createAstBuilder(text: string): AstBuilder {
  const lines = new LineIndex(text);
  const loc = (start: number, end: number): SourceLocation => ({
    start: lines.position(start),
    end: lines.position(end),
  });

  return {
    literal: (value, start, end) =>
      value === null
        ? { type: "null", value, start, end, loc: loc(start, end) }
        : { type: "boolean", value, start, end, loc: loc(start, end) },
    number: (value, raw, start, end) => ({
      type: "number",
      value,
      raw,
      start,
      end,
      loc: loc(start, end),
    }),
    string: (value, start, end) => ({
      type: "string",
      value,
      start,
      end,
      loc: loc(start, end),
    }),

    startArray: (start) => ({ start, elements: [] }),
    addElement: (array, value) => {
      array.elements.push(value);
    },
    endArray: ({ start, elements }, end): ArrayNode => ({
      type: "array",
      elements,
      start,
      end,
      loc: loc(start, end),
    }),

    startObject: (start) => ({ start, members: [], byKey: new Map() }),
    hasKey: (object, key) => object.byKey.has(key),
    setProperty: (object, key, keyStart, keyEnd, value) => {
      const keyLoc = loc(keyStart, keyEnd);
      const member: MemberNode = {
        type: "member",
        key: {
          type: "string",
          value: key,
          start: keyStart,
          end: keyEnd,
          loc: keyLoc,
        },
        value,
        start: keyStart,
        end: value.end,
        loc: { start: keyLoc.start, end: value.loc.end },
      };
      const previous = object.byKey.get(key);
      if (previous !== undefined) {
        object.members.splice(object.members.indexOf(previous), 1);
      }
      object.members.push(member);
      object.byKey.set(key, member);
    },
    endObject: ({ start, members }, end): ObjectNode => ({
      type: "object",
      members,
      start,
      end,
      loc: loc(start, end),
    }),
  };
}
