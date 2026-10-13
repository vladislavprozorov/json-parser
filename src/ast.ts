import type { SourceLocation } from "./location.ts";
import type { NumberValue } from "./types.ts";

interface NodeBase {
  readonly start: number;
  readonly end: number;
  readonly loc: SourceLocation;
}

export interface NullNode extends NodeBase {
  readonly type: "null";
  readonly value: null;
}

export interface BooleanNode extends NodeBase {
  readonly type: "boolean";
  readonly value: boolean;
}

export interface NumberNode extends NodeBase {
  readonly type: "number";
  readonly value: NumberValue;
  readonly raw: string;
}

export interface StringNode extends NodeBase {
  readonly type: "string";
  readonly value: string;
}

export interface ArrayNode extends NodeBase {
  readonly type: "array";
  readonly elements: readonly ValueNode[];
}

export interface MemberNode extends NodeBase {
  readonly type: "member";
  readonly key: StringNode;
  readonly value: ValueNode;
}

export interface ObjectNode extends NodeBase {
  readonly type: "object";
  readonly members: readonly MemberNode[];
}

export type ValueNode =
  | NullNode
  | BooleanNode
  | NumberNode
  | StringNode
  | ArrayNode
  | ObjectNode;

export type AstNode = ValueNode | MemberNode;
