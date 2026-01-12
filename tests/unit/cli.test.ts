/**
 * Unit tests for CLI and config modules
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { loadConfig } from '../../src/config';
import { printVersion, printHelp } from '../../src/cli';

describe('Config', () => {
  describe('loadConfig()', () => {
    let originalEnv: Record<string, string | undefined>;

    beforeEach(() => {
      // Save original environment variables
      originalEnv = {
        REDIS_URL: Bun.env.REDIS_URL,
        REDIS_QUEUE_PREFIX: Bun.env.REDIS_QUEUE_PREFIX,
        REDIS_QUEUE_TTL: Bun.env.REDIS_QUEUE_TTL,
        REDIS_MAX_RETRIES: Bun.env.REDIS_MAX_RETRIES,
        REDIS_RETRY_DELAY: Bun.env.REDIS_RETRY_DELAY,
        ILKKUN_CLAUDE_BIN: Bun.env.ILKKUN_CLAUDE_BIN,
        ILKKUN_GEMINI_BIN: Bun.env.ILKKUN_GEMINI_BIN,
        ILKKUN_CODEX_BIN: Bun.env.ILKKUN_CODEX_BIN,
        ILKKUN_DEFAULT_AGENT: Bun.env.ILKKUN_DEFAULT_AGENT,
        ILKKUN_DEFAULT_TIMEOUT: Bun.env.ILKKUN_DEFAULT_TIMEOUT,
        ILKKUN_LOG_LEVEL: Bun.env.ILKKUN_LOG_LEVEL,
        ILKKUN_INCLUDE_RAW: Bun.env.ILKKUN_INCLUDE_RAW,
      };

      // Clear all environment variables for clean slate
      delete Bun.env.REDIS_URL;
      delete Bun.env.REDIS_QUEUE_PREFIX;
      delete Bun.env.REDIS_QUEUE_TTL;
      delete Bun.env.REDIS_MAX_RETRIES;
      delete Bun.env.REDIS_RETRY_DELAY;
      delete Bun.env.ILKKUN_CLAUDE_BIN;
      delete Bun.env.ILKKUN_GEMINI_BIN;
      delete Bun.env.ILKKUN_CODEX_BIN;
      delete Bun.env.ILKKUN_DEFAULT_AGENT;
      delete Bun.env.ILKKUN_DEFAULT_TIMEOUT;
      delete Bun.env.ILKKUN_LOG_LEVEL;
      delete Bun.env.ILKKUN_INCLUDE_RAW;
    });

    afterEach(() => {
      // Restore original environment variables
      for (const [key, value] of Object.entries(originalEnv)) {
        if (value === undefined) {
          delete Bun.env[key];
        } else {
          Bun.env[key] = value;
        }
      }
    });

    it('returns default values when no env vars set', () => {
      const config = loadConfig();

      expect(config.redisUrl).toBe('redis://localhost:6379');
      expect(config.redisQueuePrefix).toBe('ilkkun:stream');
      expect(config.redisQueueTtl).toBe(3600);
      expect(config.redisMaxRetries).toBe(3);
      expect(config.redisRetryDelay).toBe(1000);
      expect(config.claudeBin).toBe('claude');
      expect(config.geminiBin).toBe('gemini');
      expect(config.codexBin).toBe('codex');
      expect(config.defaultAgent).toBe('claude');
      expect(config.defaultTimeout).toBe(300);
      expect(config.logLevel).toBe('info');
      expect(config.includeRaw).toBe(false);
    });

    it('reads REDIS_URL from environment', () => {
      Bun.env.REDIS_URL = 'redis://test:6379';
      const config = loadConfig();
      expect(config.redisUrl).toBe('redis://test:6379');
    });

    it('reads REDIS_QUEUE_PREFIX from environment', () => {
      Bun.env.REDIS_QUEUE_PREFIX = 'custom:prefix';
      const config = loadConfig();
      expect(config.redisQueuePrefix).toBe('custom:prefix');
    });

    it('reads all ILKKUN_* environment variables', () => {
      Bun.env.ILKKUN_CLAUDE_BIN = '/usr/bin/claude-custom';
      Bun.env.ILKKUN_GEMINI_BIN = '/usr/bin/gemini-custom';
      Bun.env.ILKKUN_CODEX_BIN = '/usr/bin/codex-custom';
      Bun.env.ILKKUN_DEFAULT_AGENT = 'gemini';
      Bun.env.ILKKUN_DEFAULT_TIMEOUT = '600';
      Bun.env.ILKKUN_LOG_LEVEL = 'debug';
      Bun.env.ILKKUN_INCLUDE_RAW = 'true';

      const config = loadConfig();

      expect(config.claudeBin).toBe('/usr/bin/claude-custom');
      expect(config.geminiBin).toBe('/usr/bin/gemini-custom');
      expect(config.codexBin).toBe('/usr/bin/codex-custom');
      expect(config.defaultAgent).toBe('gemini');
      expect(config.defaultTimeout).toBe(600);
      expect(config.logLevel).toBe('debug');
      expect(config.includeRaw).toBe(true);
    });

    it('parses numeric values correctly', () => {
      Bun.env.REDIS_QUEUE_TTL = '7200';
      Bun.env.REDIS_MAX_RETRIES = '5';
      Bun.env.REDIS_RETRY_DELAY = '2000';
      Bun.env.ILKKUN_DEFAULT_TIMEOUT = '450';

      const config = loadConfig();

      expect(config.redisQueueTtl).toBe(7200);
      expect(config.redisMaxRetries).toBe(5);
      expect(config.redisRetryDelay).toBe(2000);
      expect(config.defaultTimeout).toBe(450);
    });

    it('throws error for invalid numeric values', () => {
      Bun.env.REDIS_QUEUE_TTL = 'not-a-number';
      expect(() => loadConfig()).toThrow('Invalid REDIS_QUEUE_TTL');
    });

    it('parses boolean values correctly', () => {
      // Test true values
      Bun.env.ILKKUN_INCLUDE_RAW = 'true';
      let config = loadConfig();
      expect(config.includeRaw).toBe(true);

      Bun.env.ILKKUN_INCLUDE_RAW = 'TRUE';
      config = loadConfig();
      expect(config.includeRaw).toBe(true);

      Bun.env.ILKKUN_INCLUDE_RAW = '1';
      config = loadConfig();
      expect(config.includeRaw).toBe(true);

      // Test false values
      Bun.env.ILKKUN_INCLUDE_RAW = 'false';
      config = loadConfig();
      expect(config.includeRaw).toBe(false);

      Bun.env.ILKKUN_INCLUDE_RAW = 'FALSE';
      config = loadConfig();
      expect(config.includeRaw).toBe(false);

      Bun.env.ILKKUN_INCLUDE_RAW = '0';
      config = loadConfig();
      expect(config.includeRaw).toBe(false);

      // Test invalid values default to false
      Bun.env.ILKKUN_INCLUDE_RAW = 'invalid';
      config = loadConfig();
      expect(config.includeRaw).toBe(false);
    });

    it('validates agent type values', () => {
      Bun.env.ILKKUN_DEFAULT_AGENT = 'claude';
      let config = loadConfig();
      expect(config.defaultAgent).toBe('claude');

      Bun.env.ILKKUN_DEFAULT_AGENT = 'gemini';
      config = loadConfig();
      expect(config.defaultAgent).toBe('gemini');

      Bun.env.ILKKUN_DEFAULT_AGENT = 'codex';
      config = loadConfig();
      expect(config.defaultAgent).toBe('codex');

      // Test case insensitivity
      Bun.env.ILKKUN_DEFAULT_AGENT = 'CLAUDE';
      config = loadConfig();
      expect(config.defaultAgent).toBe('claude');
    });

    it('throws error for invalid agent type', () => {
      Bun.env.ILKKUN_DEFAULT_AGENT = 'invalid-agent';
      expect(() => loadConfig()).toThrow('Invalid ILKKUN_DEFAULT_AGENT');
    });

    it('validates log level values', () => {
      Bun.env.ILKKUN_LOG_LEVEL = 'debug';
      let config = loadConfig();
      expect(config.logLevel).toBe('debug');

      Bun.env.ILKKUN_LOG_LEVEL = 'info';
      config = loadConfig();
      expect(config.logLevel).toBe('info');

      Bun.env.ILKKUN_LOG_LEVEL = 'warn';
      config = loadConfig();
      expect(config.logLevel).toBe('warn');

      Bun.env.ILKKUN_LOG_LEVEL = 'error';
      config = loadConfig();
      expect(config.logLevel).toBe('error');

      // Test case insensitivity
      Bun.env.ILKKUN_LOG_LEVEL = 'DEBUG';
      config = loadConfig();
      expect(config.logLevel).toBe('debug');
    });

    it('throws error for invalid log level', () => {
      Bun.env.ILKKUN_LOG_LEVEL = 'invalid-level';
      expect(() => loadConfig()).toThrow('Invalid ILKKUN_LOG_LEVEL');
    });
  });
});

describe('CLI output functions', () => {
  describe('printVersion()', () => {
    it('outputs version string', () => {
      // Mock console.log to capture output
      const originalLog = console.log;
      let output = '';
      console.log = (message: string) => {
        output = message;
      };

      printVersion();

      // Restore console.log
      console.log = originalLog;

      expect(output).toMatch(/^ilkkun v\d+\.\d+\.\d+$/);
      expect(output).toContain('ilkkun v');
    });
  });

  describe('printHelp()', () => {
    it('outputs help text', () => {
      // Mock console.log to capture output
      const originalLog = console.log;
      let output = '';
      console.log = (message: string) => {
        output = message;
      };

      printHelp();

      // Restore console.log
      console.log = originalLog;

      expect(output).toContain('Usage:');
      expect(output).toContain('Options:');
      expect(output).toContain('--agent');
      expect(output).toContain('--prompt');
      expect(output).toContain('--session-id');
      expect(output).toContain('--cwd');
      expect(output).toContain('--timeout');
      expect(output).toContain('--extra-args');
      expect(output).toContain('--dry-run');
      expect(output).toContain('--no-yolo');
      expect(output).toContain('--version');
      expect(output).toContain('--help');
      expect(output).toContain('Environment Variables:');
      expect(output).toContain('Examples:');
    });

    it('includes all environment variables in help text', () => {
      const originalLog = console.log;
      let output = '';
      console.log = (message: string) => {
        output = message;
      };

      printHelp();

      console.log = originalLog;

      expect(output).toContain('REDIS_URL');
      expect(output).toContain('REDIS_QUEUE_PREFIX');
      expect(output).toContain('REDIS_QUEUE_TTL');
      expect(output).toContain('ILKKUN_CLAUDE_BIN');
      expect(output).toContain('ILKKUN_GEMINI_BIN');
      expect(output).toContain('ILKKUN_CODEX_BIN');
      expect(output).toContain('ILKKUN_DEFAULT_AGENT');
      expect(output).toContain('ILKKUN_LOG_LEVEL');
    });

    it('includes usage examples', () => {
      const originalLog = console.log;
      let output = '';
      console.log = (message: string) => {
        output = message;
      };

      printHelp();

      console.log = originalLog;

      expect(output).toContain('Examples:');
      expect(output).toContain('ilkkun -a claude');
      expect(output).toContain('ilkkun -a gemini');
      expect(output).toContain('ilkkun -a codex');
    });
  });
});

describe('CLI parseCliArgs() integration', () => {
  // Note: Direct unit testing of parseCliArgs() is challenging in Bun because
  // it relies on process.argv which can't be reliably mocked in unit tests.
  // The function uses Node's util.parseArgs which reads process.argv at call time.
  //
  // For comprehensive CLI testing, see integration tests that invoke the actual
  // binary with different argument combinations.

  it('exists and is a function', async () => {
    const { parseCliArgs } = await import('../../src/cli');
    expect(typeof parseCliArgs).toBe('function');
  });

  it('returns an object with values and positionals properties', async () => {
    const { parseCliArgs } = await import('../../src/cli');
    const result = parseCliArgs();
    expect(result).toHaveProperty('values');
    expect(result).toHaveProperty('positionals');
    expect(typeof result.values).toBe('object');
    expect(Array.isArray(result.positionals)).toBe(true);
  });
});
