/**
 * Codex CLI adapter
 * Handles Codex in headless streaming mode with --json output
 */

import { BaseAdapter } from './base';
import type { NormalizedEvent } from '../types';

/**
 * Raw event types from Codex CLI
 */
interface CodexRawEvent {
  type: string;
  [key: string]: unknown;
}

interface CodexThreadStarted {
  type: 'thread.started';
  [key: string]: unknown;
}

interface CodexTurnStarted {
  type: 'turn.started';
  [key: string]: unknown;
}

interface CodexItemMessage {
  type: 'item.message';
  content: Array<{ type: string; text?: string }>;
  [key: string]: unknown;
}

interface CodexItemReasoning {
  type: 'item.reasoning';
  content: string;
  [key: string]: unknown;
}

interface CodexItemCommandExecution {
  type: 'item.command_execution';
  command: string;
  output?: string;
  exit_code?: number;
  [key: string]: unknown;
}

interface CodexItemFileChange {
  type: 'item.file_change';
  path: string;
  diff?: string;
  [key: string]: unknown;
}

interface CodexTurnCompleted {
  type: 'turn.completed';
  [key: string]: unknown;
}

interface CodexTurnFailed {
  type: 'turn.failed';
  error: string;
  [key: string]: unknown;
}

interface CodexError {
  type: 'error';
  message: string;
  [key: string]: unknown;
}

export class CodexAdapter extends BaseAdapter {
  readonly agent = 'codex' as const;

  buildCommand(prompt: string, cwd: string, extraArgs?: string[]): string[] {
    const cmd: string[] = ['codex', 'exec'];

    // Add --yolo (auto-approve mode)
    cmd.push('--yolo');

    // Add --json for streaming JSON output
    cmd.push('--json');

    // MUST add --cwd (required for Codex)
    cmd.push('--cwd', cwd);

    // Add extra args if provided
    if (extraArgs && extraArgs.length > 0) {
      cmd.push(...extraArgs);
    }

    // Add prompt as positional argument
    cmd.push(prompt);

    return cmd;
  }

  normalizeEvent(
    rawEvent: unknown,
    sessionId: string,
    sequence: number
  ): NormalizedEvent | null {
    if (!rawEvent || typeof rawEvent !== 'object') {
      return null;
    }

    const event = rawEvent as CodexRawEvent;

    switch (event.type) {
      case 'thread.started':
        return this.createEvent(
          'session.start',
          {},
          sessionId,
          sequence,
          this.agent
        );

      case 'turn.started':
        return this.createEvent(
          'message.start',
          { role: 'assistant' as const },
          sessionId,
          sequence,
          this.agent
        );

      case 'item.message': {
        const msgEvent = event as CodexItemMessage;
        const content = msgEvent.content
          ?.map((block) => block.text || '')
          .join('');

        if (!content) return null;

        return this.createEvent(
          'message.delta',
          { content },
          sessionId,
          sequence,
          this.agent
        );
      }

      case 'item.reasoning': {
        const reasonEvent = event as CodexItemReasoning;
        return this.createEvent(
          'thinking.delta',
          { content: reasonEvent.content },
          sessionId,
          sequence,
          this.agent
        );
      }

      case 'item.command_execution': {
        const cmdEvent = event as CodexItemCommandExecution;

        // For command execution, we emit tool.end with all the info
        return this.createEvent(
          'tool.end',
          {
            toolName: 'bash',
            toolInput: { command: cmdEvent.command },
            toolOutput: cmdEvent.output,
            toolExitCode: cmdEvent.exit_code,
          },
          sessionId,
          sequence,
          this.agent
        );
      }

      case 'item.file_change': {
        const fileEvent = event as CodexItemFileChange;

        // File changes are treated as tool calls
        return this.createEvent(
          'tool.end',
          {
            toolName: 'file_edit',
            toolInput: { path: fileEvent.path },
            toolOutput: fileEvent.diff,
          },
          sessionId,
          sequence,
          this.agent
        );
      }

      case 'turn.completed':
        return this.createEvent(
          'message.end',
          {},
          sessionId,
          sequence,
          this.agent
        );

      case 'turn.failed': {
        const failEvent = event as CodexTurnFailed;
        return this.createEvent(
          'error',
          {
            errorCode: 'TURN_FAILED',
            errorMessage: failEvent.error,
          },
          sessionId,
          sequence,
          this.agent
        );
      }

      case 'error': {
        const errorEvent = event as CodexError;
        return this.createEvent(
          'error',
          {
            errorCode: 'AGENT_ERROR',
            errorMessage: errorEvent.message,
          },
          sessionId,
          sequence,
          this.agent
        );
      }

      default:
        // Skip unknown event types
        return null;
    }
  }
}
