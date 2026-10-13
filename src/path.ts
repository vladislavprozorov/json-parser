export type PathSegment = string | number;

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export function formatPath(
  path: readonly PathSegment[],
  maxSegments = Infinity,
): string {
  if (path.length <= maxSegments) return "$" + formatSegments(path);
  const head = Math.ceil(maxSegments / 2);
  const tail = maxSegments - head;
  const skipped = path.length - maxSegments;
  return (
    "$" +
    formatSegments(path.slice(0, head)) +
    ` ...${skipped} more... ` +
    formatSegments(path.slice(path.length - tail))
  );
}

function formatSegments(segments: readonly PathSegment[]): string {
  let result = "";
  for (const segment of segments) {
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
