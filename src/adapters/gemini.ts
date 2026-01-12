/**
 * Gemini CLI adapter
 *
 * Handles Gemini CLI in headless streaming mode.
 * Base command: gemini --yolo --output-format stream-json
 */

import { BaseAdapter } from './base';
import type { NormalizedEvent, EventPayload } from '../types';

/**
 * Raw event types from Gemini CLI stream
 */
interface GeminiRawEvent {
  type: 'init' | 'message' | 'tool_call' | 'tool_result' | 'done' | 'error';
  content?: string;
  name?: string;
  input?: Record<string, unknown>;
  output?: string;
  message?: string;
  [key: string]: unknown;
}

/**
 * Adapter for Gemini CLI
 */
export class GeminiAdapter extends BaseAdapter {
  private readonly agent = 'gemini' as const;

  /**
   * Build the command to execute Gemini CLI
   */
  buildCommand(prompt: string, cwd: string, extraArgs?: string[]): string[] {
    const cmd: string[] = ['gemini'];

    // Add --yolo flag for auto-approve
    cmd.push('--yolo');

    // Add stream-json output format
    cmd.push('--output-format', 'stream-json');

    // Add working directory if specified
    if (cwd) {
      cmd.push('--cwd', cwd);
    }

    // Add extra arguments if provided
    if (extraArgs && extraArgs.length > 0) {
      cmd.push(...extraArgs);
    }

    // Add the prompt as positional argument
    cmd.push(prompt);

    return cmd;
  }

  /**
   * Normalize a raw Gemini event to the standard format
   */
  normalizeEvent(
    rawEvent: unknown,
    sessionId: string,
    sequence: number
  ): NormalizedEvent | null {
    if (!rawEvent || typeof rawEvent !== 'object') {
      return null;
    }

    const event = rawEvent as GeminiRawEvent;

    // Map Gemini event types to normalized event types
    switch (event.type) {
      case 'init':
        return this.createEvent(
          'session.start',
          {},
          sessionId,
          sequence,
          this.agent,
          rawEvent
        );

      case 'message':
        return this.createEvent(
          'message.delta',
          {
            content: event.content || '',
            role: 'assistant',
          },
          sessionId,
          sequence,
          this.agent,
          rawEvent
        );

      case 'tool_call':
        return this.createEvent(
          'tool.start',
          {
            toolName: event.name || '',
            toolInput: event.input || {},
          },
          sessionId,
          sequence,
          this.agent,
          rawEvent
        );

      case 'tool_result':
        return this.createEvent(
          'tool.end',
          {
            toolOutput: event.output || '',
          },
          sessionId,
          sequence,
          this.agent,
          rawEvent
        );

      case 'done':
        return this.createEvent(
          'session.end',
          {
            exitCode: 0,
          },
          sessionId,
          sequence,
          this.agent,
          rawEvent
        );

      case 'error':
        return this.createEvent(
          'error',
          {
            errorCode: 'GEMINI_ERROR',
            errorMessage: event.message || 'Unknown error',
          },
          sessionId,
          sequence,
          this.agent,
          rawEvent
        );

      default:
        // Skip unknown event types
        return null;
    }
  }
}
