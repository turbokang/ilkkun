/**
 * Common type definitions for ilkkun
 */

export type AgentType = 'claude' | 'gemini' | 'codex';

export type EventType =
  | 'session.start'      // Session start
  | 'session.end'        // Session end
  | 'message.start'      // Message start
  | 'message.delta'      // Text chunk
  | 'message.end'        // Message end
  | 'tool.start'         // Tool call start
  | 'tool.delta'         // Tool execution output
  | 'tool.end'           // Tool call end
  | 'thinking.start'     // Reasoning start
  | 'thinking.delta'     // Reasoning in progress
  | 'thinking.end'       // Reasoning end
  | 'error'              // Error
  | 'system';            // System message

export interface EventPayload {
  // message.*
  content?: string;
  role?: 'assistant' | 'user' | 'system';

  // tool.*
  toolName?: string;
  toolId?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: string;
  toolExitCode?: number;

  // error
  errorCode?: string;
  errorMessage?: string;

  // session.end
  exitCode?: number;
  durationMs?: number;

  // system
  systemMessage?: string;
}

export interface NormalizedEvent {
  // Metadata
  id: string;                           // UUID v4
  source: AgentType;
  sessionId: string;
  timestamp: number;                    // Unix ms
  sequence: number;                     // For ordering

  // Event type
  type: EventType;

  // Payload (varies by type)
  payload: EventPayload;

  // Original data (for debugging, optional)
  raw?: unknown;
}

export interface AgentOptions {
  cwd?: string;
  noYolo?: boolean;
  extraArgs?: string;
}

export interface CLIOptions {
  agent: AgentType;
  prompt: string;
  sessionId: string;
  cwd: string;
  timeout: number;
  extraArgs?: string;
  dryRun: boolean;
  noYolo: boolean;
  noRedis: boolean;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Config {
  // Redis configuration
  redisUrl: string;
  redisQueuePrefix: string;
  redisQueueTtl: number;
  redisMaxRetries: number;
  redisRetryDelay: number;

  // Agent binary paths
  claudeBin: string;
  geminiBin: string;
  codexBin: string;

  // Default settings
  defaultAgent: AgentType;
  defaultTimeout: number;

  // Logging and debugging
  logLevel: LogLevel;
  includeRaw: boolean;
}

/**
 * Agent adapter interface
 */
export interface AgentAdapter {
  /**
   * Build the command to execute for this agent
   */
  buildCommand(prompt: string, cwd: string, extraArgs?: string[]): string[];

  /**
   * Normalize agent-specific event to standard format
   */
  normalizeEvent(
    raw: unknown,
    sessionId: string,
    sequence: number
  ): NormalizedEvent | null;
}
