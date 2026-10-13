export type PathSegment = string | number;

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export function formatPath(path: readonly PathSegment[]): string {
  let result = "$";
  for (const segment of path) {
    if (typeof segment === "number") {
      result += `[${segment}]`;
    } else if (IDENTIFIER.test(segment)) {
      result += `.${segment}`;
    } else {
      result += `[${JSON.stringify(segment)}]`;
    }
  }
  return result;
}
