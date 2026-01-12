/**
 * Unit tests for ilkkun adapters
 */

import { describe, it, expect } from 'bun:test';
import {
  ClaudeAdapter,
  GeminiAdapter,
  CodexAdapter,
  getAdapter,
} from '../../src/adapters';

describe('ClaudeAdapter', () => {
  const adapter = new ClaudeAdapter();
  const sessionId = 'test-session-123';

  describe('buildCommand', () => {
    it('generates correct command with all flags', () => {
      const cmd = adapter.buildCommand('test prompt', '/path/to/cwd');

      expect(cmd).toContain('claude');
      expect(cmd).toContain('--dangerously-skip-permissions');
      expect(cmd).toContain('--output-format');
      expect(cmd).toContain('stream-json');
      expect(cmd).toContain('--verbose');
      expect(cmd).toContain('-p');
      expect(cmd).toContain('test prompt');
    });

    it('does not include --cwd (handled by spawn)', () => {
      const cmd = adapter.buildCommand('test', '/custom/path');

      // Claude CLI doesn't support --cwd, it's set via Bun.spawn cwd option
      expect(cmd).not.toContain('--cwd');
    });

    it('handles extraArgs', () => {
      const cmd = adapter.buildCommand('test', '/path', ['--arg1', 'value1']);

      expect(cmd).toContain('--arg1');
      expect(cmd).toContain('value1');
    });

    it('preserves argument order', () => {
      const cmd = adapter.buildCommand('my prompt', '/work', ['--extra']);

      expect(cmd[0]).toBe('claude');
      expect(cmd).toContain('--dangerously-skip-permissions');
      expect(cmd).toContain('--output-format');
      expect(cmd).toContain('-p');
      expect(cmd).toContain('my prompt');
      expect(cmd[cmd.length - 1]).toBe('--extra');
    });
  });

  describe('normalizeEvent', () => {
    it('handles system events', () => {
      const rawEvent = {
        type: 'system',
        message: 'System message',
      };

      const result = adapter.normalizeEvent(rawEvent, sessionId, 1);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('system');
      expect(result?.payload.systemMessage).toBe('System message');
      expect(result?.source).toBe('claude');
      expect(result?.sessionId).toBe(sessionId);
      expect(result?.sequence).toBe(1);
    });

    it('handles message.delta events with text delta', () => {
      const rawEvent = {
        type: 'content_block_delta',
        delta: {
          text: 'Hello world',
        },
      };

      const result = adapter.normalizeEvent(rawEvent, sessionId, 2);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('message.delta');
      expect(result?.payload.content).toBe('Hello world');
    });

    it('handles message.delta events with content block text', () => {
      const rawEvent = {
        type: 'content_block_start',
        content_block: {
          type: 'text',
          text: 'Starting message',
        },
      };

      const result = adapter.normalizeEvent(rawEvent, sessionId, 3);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('message.delta');
    });

    it('handles tool.start events', () => {
      const rawEvent = {
        type: 'content_block_start',
        content_block: {
          type: 'tool_use',
          name: 'read_file',
          id: 'tool-123',
          input: { path: '/file.txt' },
        },
      };

      const result = adapter.normalizeEvent(rawEvent, sessionId, 4);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('tool.start');
      expect(result?.payload.toolName).toBe('read_file');
      expect(result?.payload.toolId).toBe('tool-123');
      expect(result?.payload.toolInput).toEqual({ path: '/file.txt' });
    });

    it('handles session.end events', () => {
      const rawEvent = {
        type: 'result',
        exit_code: 0,
        duration_ms: 5000,
      };

      const result = adapter.normalizeEvent(rawEvent, sessionId, 5);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('session.end');
      expect(result?.payload.exitCode).toBe(0);
      expect(result?.payload.durationMs).toBe(5000);
    });

    it('handles error events', () => {
      const rawEvent = {
        type: 'error',
        error: {
          code: 'RATE_LIMIT',
          message: 'Rate limit exceeded',
        },
      };

      const result = adapter.normalizeEvent(rawEvent, sessionId, 6);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('error');
      expect(result?.payload.errorCode).toBe('RATE_LIMIT');
      expect(result?.payload.errorMessage).toBe('Rate limit exceeded');
    });

    it('returns null for unknown events', () => {
      const rawEvent = {
        type: 'unknown_event_type',
        data: 'something',
      };

      const result = adapter.normalizeEvent(rawEvent, sessionId, 7);

      expect(result).toBeNull();
    });

    it('returns null for non-object events', () => {
      const result1 = adapter.normalizeEvent(null, sessionId, 8);
      const result2 = adapter.normalizeEvent('string', sessionId, 9);
      const result3 = adapter.normalizeEvent(123, sessionId, 10);

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBeNull();
    });

    it('includes raw event when provided', () => {
      const rawEvent = {
        type: 'system',
        message: 'Test',
      };

      const result = adapter.normalizeEvent(rawEvent, sessionId, 11);

      expect(result?.raw).toEqual(rawEvent);
    });

    it('generates unique event IDs', () => {
      const rawEvent = { type: 'system', message: 'Test' };

      const result1 = adapter.normalizeEvent(rawEvent, sessionId, 1);
      const result2 = adapter.normalizeEvent(rawEvent, sessionId, 2);

      expect(result1?.id).toBeDefined();
      expect(result2?.id).toBeDefined();
      expect(result1?.id).not.toBe(result2?.id);
    });
  });
});

describe('GeminiAdapter', () => {
  const adapter = new GeminiAdapter();
  const sessionId = 'gemini-session-456';

  describe('buildCommand', () => {
    it('generates correct command with --yolo and --output-format', () => {
      const cmd = adapter.buildCommand('test prompt', '/path/to/cwd');

      expect(cmd[0]).toBe('gemini');
      expect(cmd).toContain('--yolo');
      expect(cmd).toContain('--output-format');
      expect(cmd).toContain('stream-json');
      expect(cmd[cmd.length - 1]).toBe('test prompt');
    });

    it('includes --cwd when provided', () => {
      const cmd = adapter.buildCommand('test', '/custom/path');

      expect(cmd).toContain('--cwd');
      expect(cmd).toContain('/custom/path');
    });

    it('handles extraArgs', () => {
      const cmd = adapter.buildCommand('test', '/path', ['--model', 'pro']);

      expect(cmd).toContain('--model');
      expect(cmd).toContain('pro');
    });

    it('places prompt as last positional argument', () => {
      const cmd = adapter.buildCommand('my question', '/work');

      expect(cmd[cmd.length - 1]).toBe('my question');
    });
  });

  describe('normalizeEvent', () => {
    it('handles init → session.start', () => {
      const rawEvent = {
        type: 'init',
      };

      const result = adapter.normalizeEvent(rawEvent, sessionId, 1);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('session.start');
      expect(result?.source).toBe('gemini');
    });

    it('handles message → message.delta', () => {
      const rawEvent = {
        type: 'message',
        content: 'Hello from Gemini',
      };

      const result = adapter.normalizeEvent(rawEvent, sessionId, 2);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('message.delta');
      expect(result?.payload.content).toBe('Hello from Gemini');
      expect(result?.payload.role).toBe('assistant');
    });

    it('handles tool_call → tool.start', () => {
      const rawEvent = {
        type: 'tool_call',
        name: 'bash',
        input: { command: 'ls -la' },
      };

      const result = adapter.normalizeEvent(rawEvent, sessionId, 3);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('tool.start');
      expect(result?.payload.toolName).toBe('bash');
      expect(result?.payload.toolInput).toEqual({ command: 'ls -la' });
    });

    it('handles tool_result → tool.end', () => {
      const rawEvent = {
        type: 'tool_result',
        output: 'Command output',
      };

      const result = adapter.normalizeEvent(rawEvent, sessionId, 4);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('tool.end');
      expect(result?.payload.toolOutput).toBe('Command output');
    });

    it('handles done → session.end', () => {
      const rawEvent = {
        type: 'done',
      };

      const result = adapter.normalizeEvent(rawEvent, sessionId, 5);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('session.end');
      expect(result?.payload.exitCode).toBe(0);
    });

    it('handles error events', () => {
      const rawEvent = {
        type: 'error',
        message: 'API error occurred',
      };

      const result = adapter.normalizeEvent(rawEvent, sessionId, 6);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('error');
      expect(result?.payload.errorCode).toBe('GEMINI_ERROR');
      expect(result?.payload.errorMessage).toBe('API error occurred');
    });

    it('returns null for unknown event types', () => {
      const rawEvent = {
        type: 'unknown',
      };

      const result = adapter.normalizeEvent(rawEvent, sessionId, 7);

      expect(result).toBeNull();
    });

    it('returns null for invalid events', () => {
      const result1 = adapter.normalizeEvent(null, sessionId, 8);
      const result2 = adapter.normalizeEvent('not an object', sessionId, 9);

      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });

    it('handles missing optional fields gracefully', () => {
      const rawEvent = {
        type: 'message',
        // no content field
      };

      const result = adapter.normalizeEvent(rawEvent, sessionId, 10);

      expect(result).not.toBeNull();
      expect(result?.payload.content).toBe('');
    });
  });
});

describe('CodexAdapter', () => {
  const adapter = new CodexAdapter();
  const sessionId = 'codex-session-789';

  describe('buildCommand', () => {
    it('includes "exec" subcommand', () => {
      const cmd = adapter.buildCommand('test', '/work');

      expect(cmd[0]).toBe('codex');
      expect(cmd[1]).toBe('exec');
    });

    it('includes --json flag', () => {
      const cmd = adapter.buildCommand('test', '/work');

      expect(cmd).toContain('--json');
    });

    it('requires --cwd', () => {
      const cmd = adapter.buildCommand('test', '/required/path');

      expect(cmd).toContain('--cwd');
      expect(cmd).toContain('/required/path');
    });

    it('includes --yolo flag', () => {
      const cmd = adapter.buildCommand('test', '/work');

      expect(cmd).toContain('--yolo');
    });

    it('handles extraArgs', () => {
      const cmd = adapter.buildCommand('test', '/work', ['--verbose']);

      expect(cmd).toContain('--verbose');
    });

    it('places prompt as last argument', () => {
      const cmd = adapter.buildCommand('my task', '/work');

      expect(cmd[cmd.length - 1]).toBe('my task');
    });
  });

  describe('normalizeEvent', () => {
    it('handles thread.started → session.start', () => {
      const rawEvent = {
        type: 'thread.started',
      };

      const result = adapter.normalizeEvent(rawEvent, sessionId, 1);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('session.start');
      expect(result?.source).toBe('codex');
    });

    it('handles turn.started → message.start', () => {
      const rawEvent = {
        type: 'turn.started',
      };

      const result = adapter.normalizeEvent(rawEvent, sessionId, 2);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('message.start');
      expect(result?.payload.role).toBe('assistant');
    });

    it('handles item.message → message.delta', () => {
      const rawEvent = {
        type: 'item.message',
        content: [
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'world' },
        ],
      };

      const result = adapter.normalizeEvent(rawEvent, sessionId, 3);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('message.delta');
      expect(result?.payload.content).toBe('Hello world');
    });

    it('handles item.message with empty content', () => {
      const rawEvent = {
        type: 'item.message',
        content: [],
      };

      const result = adapter.normalizeEvent(rawEvent, sessionId, 4);

      expect(result).toBeNull();
    });

    it('handles item.reasoning → thinking.delta', () => {
      const rawEvent = {
        type: 'item.reasoning',
        content: 'Thinking about the problem...',
      };

      const result = adapter.normalizeEvent(rawEvent, sessionId, 5);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('thinking.delta');
      expect(result?.payload.content).toBe('Thinking about the problem...');
    });

    it('handles item.command_execution → tool.end', () => {
      const rawEvent = {
        type: 'item.command_execution',
        command: 'npm test',
        output: 'All tests passed',
        exit_code: 0,
      };

      const result = adapter.normalizeEvent(rawEvent, sessionId, 6);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('tool.end');
      expect(result?.payload.toolName).toBe('bash');
      expect(result?.payload.toolInput).toEqual({ command: 'npm test' });
      expect(result?.payload.toolOutput).toBe('All tests passed');
      expect(result?.payload.toolExitCode).toBe(0);
    });

    it('handles item.file_change → tool.end', () => {
      const rawEvent = {
        type: 'item.file_change',
        path: '/src/main.ts',
        diff: '- old line\n+ new line',
      };

      const result = adapter.normalizeEvent(rawEvent, sessionId, 7);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('tool.end');
      expect(result?.payload.toolName).toBe('file_edit');
      expect(result?.payload.toolInput).toEqual({ path: '/src/main.ts' });
      expect(result?.payload.toolOutput).toBe('- old line\n+ new line');
    });

    it('handles turn.completed → message.end', () => {
      const rawEvent = {
        type: 'turn.completed',
      };

      const result = adapter.normalizeEvent(rawEvent, sessionId, 8);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('message.end');
    });

    it('handles turn.failed → error', () => {
      const rawEvent = {
        type: 'turn.failed',
        error: 'Turn execution failed',
      };

      const result = adapter.normalizeEvent(rawEvent, sessionId, 9);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('error');
      expect(result?.payload.errorCode).toBe('TURN_FAILED');
      expect(result?.payload.errorMessage).toBe('Turn execution failed');
    });

    it('handles error events', () => {
      const rawEvent = {
        type: 'error',
        message: 'General error',
      };

      const result = adapter.normalizeEvent(rawEvent, sessionId, 10);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('error');
      expect(result?.payload.errorCode).toBe('AGENT_ERROR');
      expect(result?.payload.errorMessage).toBe('General error');
    });

    it('returns null for unknown event types', () => {
      const rawEvent = {
        type: 'unknown.event',
      };

      const result = adapter.normalizeEvent(rawEvent, sessionId, 11);

      expect(result).toBeNull();
    });

    it('returns null for invalid events', () => {
      const result1 = adapter.normalizeEvent(null, sessionId, 12);
      const result2 = adapter.normalizeEvent(undefined, sessionId, 13);
      const result3 = adapter.normalizeEvent(42, sessionId, 14);

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBeNull();
    });
  });
});

describe('getAdapter factory', () => {
  it('returns ClaudeAdapter for "claude" agent type', () => {
    const adapter = getAdapter('claude');

    expect(adapter).toBeInstanceOf(ClaudeAdapter);
  });

  it('returns GeminiAdapter for "gemini" agent type', () => {
    const adapter = getAdapter('gemini');

    expect(adapter).toBeInstanceOf(GeminiAdapter);
  });

  it('returns CodexAdapter for "codex" agent type', () => {
    const adapter = getAdapter('codex');

    expect(adapter).toBeInstanceOf(CodexAdapter);
  });

  it('throws error for invalid agent type', () => {
    expect(() => {
      // @ts-expect-error - Testing invalid input
      getAdapter('invalid');
    }).toThrow('Unknown agent type: invalid');
  });

  it('returns new instance each time', () => {
    const adapter1 = getAdapter('claude');
    const adapter2 = getAdapter('claude');

    // Different instances
    expect(adapter1).not.toBe(adapter2);
    // But same type
    expect(adapter1).toBeInstanceOf(ClaudeAdapter);
    expect(adapter2).toBeInstanceOf(ClaudeAdapter);
  });
});
