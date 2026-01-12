import { NDJSONParser } from './ndjson-parser';
import { EventNormalizer } from './normalizer';
import type { NormalizedEvent, Config } from '../types';
import type { BaseAdapter } from '../adapters/base';

export class StreamProcessor {
  private parser: NDJSONParser;
  private normalizer: EventNormalizer;

  constructor(
    adapter: BaseAdapter,
    sessionId: string,
    private config: Config
  ) {
    this.parser = new NDJSONParser();
    this.normalizer = new EventNormalizer(adapter, sessionId);
  }

  processChunk(chunk: string): NormalizedEvent[] {
    const rawEvents = this.parser.parse(chunk);
    const normalized: NormalizedEvent[] = [];

    for (const rawEvent of rawEvents) {
      const event = this.normalizer.normalize(rawEvent);
      if (event !== null) {
        normalized.push(event);
      }
    }

    return normalized;
  }

  flush(): NormalizedEvent[] {
    const rawEvents = this.parser.flush();
    const normalized: NormalizedEvent[] = [];

    for (const rawEvent of rawEvents) {
      const event = this.normalizer.normalize(rawEvent);
      if (event !== null) {
        normalized.push(event);
      }
    }

    return normalized;
  }
}
