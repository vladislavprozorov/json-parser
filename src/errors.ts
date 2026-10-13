import { LineIndex } from "./location.ts";
import { formatPath, type PathSegment } from "./path.ts";

export class ParseFailure extends Error {
  readonly position: number;

  constructor(message: string, position: number) {
    super(message);
    this.name = "ParseFailure";
    this.position = position;
  }
}

const MESSAGE_PATH_SEGMENTS = 16;

export class JSONParseError extends SyntaxError {
  readonly reason: string;
  readonly position: number;
  readonly line: number;
  readonly column: number;
  readonly path: readonly PathSegment[];

  constructor(
    reason: string,
    source: string,
    position: number,
    path: readonly PathSegment[],
  ) {
    const { line, column } = new LineIndex(source).position(position);
    super(
      `${reason} at ${formatPath(path, MESSAGE_PATH_SEGMENTS)}, line ${line}, column ${column} (position ${position})`,
    );
    this.name = "JSONParseError";
    this.reason = reason;
    this.position = position;
    this.line = line;
    this.column = column;
    this.path = path;
  }
}
