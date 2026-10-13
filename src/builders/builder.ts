import type { NumberValue } from "../types.ts";

export interface Builder<Value, ArrayState, ObjectState> {
  literal(value: boolean | null, start: number, end: number): Value;
  number(value: NumberValue, raw: string, start: number, end: number): Value;
  string(value: string, start: number, end: number): Value;

  startArray(start: number): ArrayState;
  addElement(array: ArrayState, value: Value): void;
  endArray(array: ArrayState, end: number): Value;

  startObject(start: number): ObjectState;
  hasKey(object: ObjectState, key: string): boolean;
  setProperty(
    object: ObjectState,
    key: string,
    keyStart: number,
    keyEnd: number,
    value: Value,
  ): void;
  endObject(object: ObjectState, end: number): Value;
}
