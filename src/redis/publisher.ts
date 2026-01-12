import type Redis from 'ioredis';
import type { NormalizedEvent, Config, AgentType } from '../types';

/**
 * RedisPublisher handles publishing normalized events to Redis queues
 */
export class RedisPublisher {
  private sequenceCounter = 0;

  constructor(
    private client: Redis,
    private config: Config
  ) {}

  /**
   * Get the Redis queue key for a session
   */
  getQueueKey(sessionId: string): string {
    return `${this.config.redisQueuePrefix}:${sessionId}`;
  }

  /**
   * Publish a normalized event to the session queue
   */
  async publish(event: NormalizedEvent): Promise<void> {
    try {
      const queueKey = this.getQueueKey(event.sessionId);
      const jsonString = JSON.stringify(event);

      await this.client.rpush(queueKey, jsonString);

      // Set TTL if configured and this is the first event
      if (this.sequenceCounter === 1 && this.config.redisQueueTtl > 0) {
        await this.setTTL(event.sessionId);
      }
    } catch (error) {
      const err = error as Error;
      throw new Error(`Failed to publish event to Redis: ${err.message}`);
    }
  }

  /**
   * Set TTL for a session queue
   */
  async setTTL(sessionId: string): Promise<void> {
    if (this.config.redisQueueTtl > 0) {
      try {
        const queueKey = this.getQueueKey(sessionId);
        await this.client.expire(queueKey, this.config.redisQueueTtl);
      } catch (error) {
        const err = error as Error;
        console.error(`[Redis Publisher] Failed to set TTL: ${err.message}`);
      }
    }
  }

  /**
   * Create and push a session.start event
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
   * Create and push a session.end event
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
   * Close the Redis connection
   */
  async close(): Promise<void> {
    try {
      await this.client.quit();
    } catch (error) {
      const err = error as Error;
      console.error(`[Redis Publisher] Error closing connection: ${err.message}`);
      // Force disconnect if graceful quit fails
      this.client.disconnect();
    }
  }

  /**
   * Get the current sequence number (for external use)
   */
  getNextSequence(): number {
    return this.sequenceCounter++;
  }
}
