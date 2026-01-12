export class NDJSONParser {
  private buffer: string = '';

  parse(chunk: string): unknown[] {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');

    // Keep the last incomplete line in the buffer
    this.buffer = lines.pop() || '';

    const parsed: unknown[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      try {
        const obj = JSON.parse(trimmed);
        parsed.push(obj);
      } catch (error) {
        console.error('Failed to parse JSON line:', error);
        console.error('Invalid line:', trimmed);
      }
    }

    return parsed;
  }

  flush(): unknown[] {
    if (!this.buffer.trim()) {
      return [];
    }

    try {
      const obj = JSON.parse(this.buffer.trim());
      this.buffer = '';
      return [obj];
    } catch (error) {
      console.error('Failed to parse remaining buffer:', error);
      console.error('Invalid buffer:', this.buffer);
      this.buffer = '';
      return [];
    }
  }
}
