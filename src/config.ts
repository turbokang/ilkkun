/**
 * Configuration management for ilkkun
 * Loads and validates environment variables
 */

import type { Config, AgentType, LogLevel } from './types';

/**
 * Parse a string value as a number with validation
 */
function parseNumber(
  value: string | undefined,
  defaultValue: number,
  varName: string
): number {
  if (!value) {
    return defaultValue;
  }

  const parsed = Number(value);
  if (isNaN(parsed)) {
    throw new Error(
      `Invalid ${varName}: expected number, got "${value}"`
    );
  }

  return parsed;
}

/**
 * Parse a string value as a boolean
 */
function parseBoolean(
  value: string | undefined,
  defaultValue: boolean
): boolean {
  if (!value) {
    return defaultValue;
  }

  const normalized = value.toLowerCase().trim();
  if (normalized === 'true' || normalized === '1') {
    return true;
  }
  if (normalized === 'false' || normalized === '0') {
    return false;
  }

  return defaultValue;
}

/**
 * Validate and return a valid AgentType
 */
function parseAgentType(
  value: string | undefined,
  defaultValue: AgentType
): AgentType {
  if (!value) {
    return defaultValue;
  }

  const normalized = value.toLowerCase() as AgentType;
  const validAgents: AgentType[] = ['claude', 'gemini', 'codex'];

  if (!validAgents.includes(normalized)) {
    throw new Error(
      `Invalid ILKKUN_DEFAULT_AGENT: expected one of ${validAgents.join(', ')}, got "${value}"`
    );
  }

  return normalized;
}

/**
 * Validate and return a valid LogLevel
 */
function parseLogLevel(
  value: string | undefined,
  defaultValue: LogLevel
): LogLevel {
  if (!value) {
    return defaultValue;
  }

  const normalized = value.toLowerCase() as LogLevel;
  const validLevels: LogLevel[] = ['debug', 'info', 'warn', 'error'];

  if (!validLevels.includes(normalized)) {
    throw new Error(
      `Invalid ILKKUN_LOG_LEVEL: expected one of ${validLevels.join(', ')}, got "${value}"`
    );
  }

  return normalized;
}

/**
 * Load configuration from environment variables
 *
 * @returns Config object with all settings
 * @throws Error if validation fails
 */
export function loadConfig(): Config {
  const env = Bun.env;

  return {
    // Redis configuration
    redisUrl: env.REDIS_URL || 'redis://localhost:6379',
    redisQueuePrefix: env.REDIS_QUEUE_PREFIX || 'ilkkun:stream',
    redisQueueTtl: parseNumber(env.REDIS_QUEUE_TTL, 3600, 'REDIS_QUEUE_TTL'),
    redisMaxRetries: parseNumber(env.REDIS_MAX_RETRIES, 3, 'REDIS_MAX_RETRIES'),
    redisRetryDelay: parseNumber(env.REDIS_RETRY_DELAY, 1000, 'REDIS_RETRY_DELAY'),

    // Agent binary paths
    claudeBin: env.ILKKUN_CLAUDE_BIN || 'claude',
    geminiBin: env.ILKKUN_GEMINI_BIN || 'gemini',
    codexBin: env.ILKKUN_CODEX_BIN || 'codex',

    // Default settings
    defaultAgent: parseAgentType(env.ILKKUN_DEFAULT_AGENT, 'claude'),
    defaultTimeout: parseNumber(env.ILKKUN_DEFAULT_TIMEOUT, 300, 'ILKKUN_DEFAULT_TIMEOUT'),

    // Logging and debugging
    logLevel: parseLogLevel(env.ILKKUN_LOG_LEVEL, 'info'),
    includeRaw: parseBoolean(env.ILKKUN_INCLUDE_RAW, false),
  };
}
