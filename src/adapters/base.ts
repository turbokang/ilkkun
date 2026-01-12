/**
 * Base adapter interface for AI CLI agents
 */

import type {
  AgentAdapter,
  AgentType,
  EventPayload,
  EventType,
  NormalizedEvent,
} from '../types';

export abstract class BaseAdapter implements AgentAdapter {
  /**
   * Build command array for spawning the agent process
   * Must be implemented by subclasses
   */
  abstract buildCommand(
    prompt: string,
    cwd: string,
    extraArgs?: string[]
  ): string[];

  /**
   * Normalize a raw event from the agent's stream to a NormalizedEvent
   * Returns null if the event should be skipped
   * Must be implemented by subclasses
   */
  abstract normalizeEvent(
    raw: unknown,
    sessionId: string,
    sequence: number
  ): NormalizedEvent | null;

  /**
   * Create a normalized event with common fields
   * Helper method for subclasses
   */
  protected createEvent(
    type: EventType,
    payload: EventPayload,
    sessionId: string,
    sequence: number,
    source: AgentType,
    raw?: unknown
  ): NormalizedEvent {
    return {
      id: crypto.randomUUID(),
      source,
      sessionId,
      timestamp: Date.now(),
      sequence,
      type,
      payload,
      ...(raw !== undefined && { raw }),
    };
  }
}
