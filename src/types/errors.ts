export class JSONParseError extends SyntaxError {
  readonly position: number;
  readonly line: number;
  readonly column: number;

  constructor(message: string, source: string, position: number) {
    const { line, column } = locate(source, position);
    super(
      `${message} at line ${line}, column ${column} (position ${position})`,
    );
    this.name = "JSONParseError";
    this.position = position;
    this.line = line;
    this.column = column;
  }
}

function locate(source: string, position: number) {
  let line = 1;
  let column = 1;
  for (let i = 0; i < position && i < source.length; i++) {
    if (source[i] === "\n") {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return { line, column };
}
