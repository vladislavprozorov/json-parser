export type NumberValue = number | bigint | string;
export type JSONPrimitive = string | number | bigint | boolean | null;
export type JSONArray = JSONValue[];
export type JSONObject = { [key: string]: JSONValue };
export type JSONValue = JSONPrimitive | JSONArray | JSONObject;
