export interface Position {
  readonly line: number;
  readonly column: number;
  readonly offset: number;
}

export interface SourceLocation {
  readonly start: Position;
  readonly end: Position;
}

export class LineIndex {
  private readonly starts: number[] = [0];
  private last = 0;

  constructor(text: string) {
    for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1)) {
      this.starts.push(i + 1);
    }
  }

  position(offset: number): Position {
    const line = this.lineAt(offset);
    return { line: line + 1, column: offset - this.starts[line]! + 1, offset };
  }

  private lineAt(offset: number): number {
    const { starts } = this;
    const cached = this.last;
    if (
      offset >= starts[cached]! &&
      (cached + 1 === starts.length || offset < starts[cached + 1]!)
    ) {
      return cached;
    }
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >>> 1;
      if (starts[mid]! <= offset) low = mid;
      else high = mid - 1;
    }
    this.last = low;
    return low;
  }
}
