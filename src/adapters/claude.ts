/**
 * Claude Code CLI adapter
 */

import { BaseAdapter } from './base';
import type { EventType, EventPayload } from '../types';

export class ClaudeAdapter extends BaseAdapter {
  private readonly agent = 'claude' as const;

  buildCommand(prompt: string, cwd: string, extraArgs?: string[]): string[] {
    const cmd: string[] = ['claude'];

    // Required for headless mode
    cmd.push('--dangerously-skip-permissions');
    cmd.push('--output-format', 'stream-json');
    // --verbose is required for stream-json to output detailed events
    cmd.push('--verbose');

    // Note: Claude CLI doesn't have --cwd flag
    // Working directory is set via Bun.spawn cwd option in ProcessRunner

    // Prompt
    cmd.push('-p', prompt);

    // Extra arguments
    if (extraArgs && extraArgs.length > 0) {
      cmd.push(...extraArgs);
    }

    return cmd;
  }

  normalizeEvent(
    raw: unknown,
    sessionId: string,
    sequence: number
  ): ReturnType<BaseAdapter['normalizeEvent']> {
    if (!this.isClaudeEvent(raw)) {
      return null;
    }

    const type = this.mapEventType(raw);
    if (!type) {
      return null;
    }

    const payload = this.extractPayload(raw, type);

    return this.createEvent(type, payload, sessionId, sequence, this.agent, raw);
  }

  private isClaudeEvent(event: unknown): event is Record<string, any> {
    return typeof event === 'object' && event !== null && 'type' in event;
  }

  private mapEventType(event: Record<string, any>): EventType | null {
    const eventType = event.type;

    switch (eventType) {
      case 'system':
        return 'system';

      case 'assistant':
        return 'message.start';

      case 'content_block_start':
        if (event.content_block?.type === 'text') {
          return 'message.delta';
        }
        if (event.content_block?.type === 'tool_use') {
          return 'tool.start';
        }
        return null;

      case 'content_block_delta':
        // Text content delta
        if (event.delta?.text !== undefined) {
          return 'message.delta';
        }
        // Could be tool output delta
        return 'message.delta';

      case 'content_block_stop':
        // This could be end of tool or end of message
        // We'll use message.end as default, context will determine
        return 'message.end';

      case 'result':
        return 'session.end';

      case 'error':
        return 'error';

      default:
        return null;
    }
  }

  private extractPayload(
    event: Record<string, any>,
    type: EventType
  ): EventPayload {
    const payload: EventPayload = {};

    switch (type) {
      case 'system':
        payload.systemMessage = event.message || event.content || '';
        break;

      case 'message.start':
        payload.role = 'assistant';
        break;

      case 'message.delta':
        if (event.delta?.text !== undefined) {
          payload.content = event.delta.text;
        } else if (event.content_block?.text !== undefined) {
          payload.content = event.content_block.text;
        }
        break;

      case 'tool.start':
        if (event.content_block?.type === 'tool_use') {
          payload.toolName = event.content_block.name;
          payload.toolId = event.content_block.id;
          payload.toolInput = event.content_block.input;
        }
        break;

      case 'session.end':
        if (event.exit_code !== undefined) {
          payload.exitCode = event.exit_code;
        }
        if (event.duration_ms !== undefined) {
          payload.durationMs = event.duration_ms;
        }
        break;

      case 'error':
        payload.errorCode = event.error?.code || 'UNKNOWN_ERROR';
        payload.errorMessage = event.error?.message || event.message || 'An error occurred';
        break;
    }

    return payload;
  }
}
