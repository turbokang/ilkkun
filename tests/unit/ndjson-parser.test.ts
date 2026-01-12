import { describe, it, expect } from 'bun:test';
import { NDJSONParser } from '../../src/stream/ndjson-parser';

describe('NDJSONParser', () => {
  describe('Basic parsing', () => {
    it('parses single complete JSON line', () => {
      const parser = new NDJSONParser();
      const result = parser.parse('{"name":"Alice","age":30}\n');

      expect(result).toEqual([{ name: 'Alice', age: 30 }]);
    });

    it('parses multiple JSON lines at once', () => {
      const parser = new NDJSONParser();
      const input = '{"id":1}\n{"id":2}\n{"id":3}\n';
      const result = parser.parse(input);

      expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    });

    it('returns empty array for empty input', () => {
      const parser = new NDJSONParser();
      const result = parser.parse('');

      expect(result).toEqual([]);
    });

    it('parses arrays and primitives', () => {
      const parser = new NDJSONParser();
      const input = '{"items":[1,2,3]}\n{"enabled":true}\n{"count":42}\n';
      const result = parser.parse(input);

      expect(result).toEqual([
        { items: [1, 2, 3] },
        { enabled: true },
        { count: 42 }
      ]);
    });
  });

  describe('Buffer handling', () => {
    it('buffers incomplete lines across chunks', () => {
      const parser = new NDJSONParser();

      // First chunk: incomplete JSON
      const result1 = parser.parse('{"name":"Bo');
      expect(result1).toEqual([]);

      // Second chunk: completes the JSON
      const result2 = parser.parse('b"}\n');
      expect(result2).toEqual([{ name: 'Bob' }]);
    });

    it('handles split JSON objects correctly', () => {
      const parser = new NDJSONParser();

      // Split across multiple chunks
      const result1 = parser.parse('{"fi');
      expect(result1).toEqual([]);

      const result2 = parser.parse('rst":"Alice"');
      expect(result2).toEqual([]);

      const result3 = parser.parse(',"last":"Smith"}\n');
      expect(result3).toEqual([{ first: 'Alice', last: 'Smith' }]);
    });

    it('flush() returns remaining buffered data', () => {
      const parser = new NDJSONParser();

      // Parse complete line
      parser.parse('{"id":1}\n');

      // Add incomplete line
      parser.parse('{"id":2}');

      // Flush should return the buffered data
      const flushed = parser.flush();
      expect(flushed).toEqual([{ id: 2 }]);
    });

    it('flush() returns empty array if buffer is empty', () => {
      const parser = new NDJSONParser();
      const flushed = parser.flush();

      expect(flushed).toEqual([]);
    });

    it('flush() clears buffer after returning data', () => {
      const parser = new NDJSONParser();
      parser.parse('{"id":1}');

      // First flush returns data
      const flushed1 = parser.flush();
      expect(flushed1).toEqual([{ id: 1 }]);

      // Second flush returns empty
      const flushed2 = parser.flush();
      expect(flushed2).toEqual([]);
    });

    it('handles multiple complete lines with incomplete trailing line', () => {
      const parser = new NDJSONParser();
      const result = parser.parse('{"id":1}\n{"id":2}\n{"id":3}');

      expect(result).toEqual([{ id: 1 }, { id: 2 }]);

      const flushed = parser.flush();
      expect(flushed).toEqual([{ id: 3 }]);
    });
  });

  describe('Edge cases', () => {
    it('handles empty lines (skips them)', () => {
      const parser = new NDJSONParser();
      const input = '{"id":1}\n\n{"id":2}\n';
      const result = parser.parse(input);

      expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('handles whitespace-only lines', () => {
      const parser = new NDJSONParser();
      const input = '{"id":1}\n   \n\t\n{"id":2}\n';
      const result = parser.parse(input);

      expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('gracefully handles invalid JSON (skips line, does not throw)', () => {
      const parser = new NDJSONParser();
      const input = '{"id":1}\n{invalid json}\n{"id":2}\n';

      // Should not throw
      const result = parser.parse(input);

      // Should skip the invalid line
      expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('handles JSON with newlines inside strings', () => {
      const parser = new NDJSONParser();
      // Note: In NDJSON, newlines in strings should be escaped
      const input = '{"text":"line1\\nline2"}\n';
      const result = parser.parse(input);

      expect(result).toEqual([{ text: 'line1\nline2' }]);
    });

    it('handles multiple newlines between objects', () => {
      const parser = new NDJSONParser();
      const input = '{"id":1}\n\n\n{"id":2}\n\n{"id":3}\n';
      const result = parser.parse(input);

      expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    });

    it('handles whitespace around JSON objects', () => {
      const parser = new NDJSONParser();
      const input = '  {"id":1}  \n\t{"id":2}\t\n';
      const result = parser.parse(input);

      expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('handles complex nested objects', () => {
      const parser = new NDJSONParser();
      const input = '{"user":{"name":"Alice","address":{"city":"NYC","zip":10001}}}\n';
      const result = parser.parse(input);

      expect(result).toEqual([{
        user: {
          name: 'Alice',
          address: {
            city: 'NYC',
            zip: 10001
          }
        }
      }]);
    });

    it('flush() handles invalid JSON gracefully', () => {
      const parser = new NDJSONParser();
      parser.parse('{invalid');

      // Should not throw
      const flushed = parser.flush();

      // Should return empty array
      expect(flushed).toEqual([]);
    });

    it('flush() handles whitespace-only buffer', () => {
      const parser = new NDJSONParser();
      parser.parse('   \n\t');

      const flushed = parser.flush();
      expect(flushed).toEqual([]);
    });
  });

  describe('Streaming simulation', () => {
    it('processes chunks that split in middle of JSON', () => {
      const parser = new NDJSONParser();
      const fullJSON = '{"name":"Alice","age":30,"city":"NYC"}';

      // Split in the middle
      const chunk1 = fullJSON.slice(0, 20);
      const chunk2 = fullJSON.slice(20) + '\n';

      const result1 = parser.parse(chunk1);
      expect(result1).toEqual([]);

      const result2 = parser.parse(chunk2);
      expect(result2).toEqual([{ name: 'Alice', age: 30, city: 'NYC' }]);
    });

    it('processes chunks that split on newline', () => {
      const parser = new NDJSONParser();

      // Split exactly on newline
      const result1 = parser.parse('{"id":1}\n');
      expect(result1).toEqual([{ id: 1 }]);

      const result2 = parser.parse('{"id":2}\n');
      expect(result2).toEqual([{ id: 2 }]);
    });

    it('combines multiple partial chunks correctly', () => {
      const parser = new NDJSONParser();

      // Simulate streaming data arriving in small chunks
      parser.parse('{"us');
      parser.parse('er":');
      parser.parse('"Ali');
      const result1 = parser.parse('ce"}\n');
      expect(result1).toEqual([{ user: 'Alice' }]);

      parser.parse('{"us');
      parser.parse('er":"');
      const result2 = parser.parse('Bob"}\n');
      expect(result2).toEqual([{ user: 'Bob' }]);
    });

    it('handles real-world streaming scenario', () => {
      const parser = new NDJSONParser();

      // First chunk: complete object + partial
      const result1 = parser.parse('{"id":1,"status":"complete"}\n{"id":2,"st');
      expect(result1).toEqual([{ id: 1, status: 'complete' }]);

      // Second chunk: completes previous + new complete + partial
      const result2 = parser.parse('atus":"pending"}\n{"id":3,"status":"active"}\n{"id":4');
      expect(result2).toEqual([
        { id: 2, status: 'pending' },
        { id: 3, status: 'active' }
      ]);

      // Third chunk: completes last object
      const result3 = parser.parse(',"status":"done"}\n');
      expect(result3).toEqual([{ id: 4, status: 'done' }]);
    });

    it('handles chunk with multiple complete lines and partial line', () => {
      const parser = new NDJSONParser();

      const chunk = '{"a":1}\n{"b":2}\n{"c":3}\n{"d":';
      const result = parser.parse(chunk);

      expect(result).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);

      const result2 = parser.parse('4}\n');
      expect(result2).toEqual([{ d: 4 }]);
    });

    it('handles byte-boundary splits (simulating network chunks)', () => {
      const parser = new NDJSONParser();
      const data = '{"message":"Hello, World!"}\n{"count":42}\n';

      // Split into arbitrary small chunks
      const chunkSize = 5;
      const results: unknown[] = [];

      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        const parsed = parser.parse(chunk);
        results.push(...parsed);
      }

      expect(results).toEqual([
        { message: 'Hello, World!' },
        { count: 42 }
      ]);
    });
  });

  describe('State management', () => {
    it('maintains independent state across parser instances', () => {
      const parser1 = new NDJSONParser();
      const parser2 = new NDJSONParser();

      parser1.parse('{"id":1}');
      parser2.parse('{"id":99}');

      const flushed1 = parser1.flush();
      const flushed2 = parser2.flush();

      expect(flushed1).toEqual([{ id: 1 }]);
      expect(flushed2).toEqual([{ id: 99 }]);
    });

    it('can be reused after flush', () => {
      const parser = new NDJSONParser();

      // First use
      parser.parse('{"id":1}\n');
      parser.parse('{"id":2}');
      parser.flush();

      // Second use
      const result = parser.parse('{"id":3}\n');
      expect(result).toEqual([{ id: 3 }]);

      parser.parse('{"id":4}');
      const flushed = parser.flush();
      expect(flushed).toEqual([{ id: 4 }]);
    });
  });
});
