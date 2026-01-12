/**
 * StdoutPublisher - outputs normalized events to stdout in NDJSON format
 * Used when --no-redis flag is set for testing without Redis
 */

import type { NormalizedEvent, AgentType } from '../types';

export class StdoutPublisher {
  private sequenceCounter = 0;

  constructor(private sessionId: string) {}

  /**
   * Publish a normalized event to stdout
   */
  async publish(event: NormalizedEvent): Promise<void> {
    console.log(JSON.stringify(event));
  }

  /**
   * Create and output a session.start event
   */
  async pushSessionStart(sessionId: string, source: AgentType): Promise<void> {
    this.sequenceCounter = 0;

    const event: NormalizedEvent = {
      id: crypto.randomUUID(),
      source,
      sessionId,
      timestamp: Date.now(),
      sequence: this.sequenceCounter++,
      type: 'session.start',
      payload: {},
    };

    await this.publish(event);
  }

  /**
   * Create and output a session.end event
   */
  async pushSessionEnd(
    sessionId: string,
    source: AgentType,
    exitCode: number,
    durationMs: number
  ): Promise<void> {
    const event: NormalizedEvent = {
      id: crypto.randomUUID(),
      source,
      sessionId,
      timestamp: Date.now(),
      sequence: this.sequenceCounter++,
      type: 'session.end',
      payload: {
        exitCode,
        durationMs,
      },
    };

    await this.publish(event);
  }

  /**
   * No-op close for compatibility with RedisPublisher interface
   */
  async close(): Promise<void> {
    // Nothing to close for stdout
  }

  /**
   * Get the current sequence number
   */
  getNextSequence(): number {
    return this.sequenceCounter++;
  }
}
