import { BaseAdapter } from '../adapters/base';
import type { NormalizedEvent } from '../types';

export class EventNormalizer {
  private sequence: number = 0;

  constructor(
    private adapter: BaseAdapter,
    private sessionId: string
  ) {}

  normalize(rawEvent: unknown): NormalizedEvent | null {
    return this.adapter.normalizeEvent(rawEvent, this.sessionId, this.sequence++);
  }
}
