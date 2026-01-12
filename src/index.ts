#!/usr/bin/env bun
/**
 * ilkkun - AI CLI Agent Bridge to Redis
 *
 * Runs AI CLI agents (Claude Code, Gemini CLI, Codex CLI) in headless mode
 * and streams their NDJSON output to Redis queues with normalized events.
 */

import { parseCliArgs, validateArgs, printHelp, printVersion } from './cli';
import { loadConfig } from './config';
import { getAdapter } from './adapters';
import { createRedisClient } from './redis/client';
import { RedisPublisher } from './redis/publisher';
import { StdoutPublisher } from './redis/stdout-publisher';
import { ProcessRunner } from './process/runner';
import { SignalHandler } from './process/signal-handler';

// Exit codes
const EXIT_SUCCESS = 0;
const EXIT_GENERAL_ERROR = 1;
const EXIT_CLI_ERROR = 2;
const EXIT_AGENT_ERROR = 3;
const EXIT_REDIS_ERROR = 4;

async function main(): Promise<number> {
  try {
    // Parse CLI arguments
    const { values } = parseCliArgs();

    // Handle help and version
    if (values.help) {
      printHelp();
      return EXIT_SUCCESS;
    }

    if (values.version) {
      printVersion();
      return EXIT_SUCCESS;
    }

    // Validate and normalize arguments
    const options = await validateArgs(values);

    // Load configuration
    const config = loadConfig();

    // Get the appropriate adapter
    const adapter = getAdapter(options.agent);

    // Handle dry-run mode
    if (options.dryRun) {
      const extraArgs = options.extraArgs
        ? parseExtraArgs(options.extraArgs)
        : undefined;
      const command = adapter.buildCommand(options.prompt, options.cwd, extraArgs);
      console.log('Dry run mode - command that would be executed:');
      console.log(command.join(' '));
      console.log('\nSession ID:', options.sessionId);
      if (!options.noRedis) {
        console.log('Redis Queue:', `${config.redisQueuePrefix}:${options.sessionId}`);
      } else {
        console.log('Output: stdout (NDJSON)');
      }
      return EXIT_SUCCESS;
    }

    // Set up signal handler
    const signalHandler = new SignalHandler();
    signalHandler.setup();

    let publisher: RedisPublisher | StdoutPublisher;

    // Handle --no-redis mode (output to stdout)
    if (options.noRedis) {
      publisher = new StdoutPublisher(options.sessionId);
    } else {
      // Create Redis client and publisher
      const redisClient = createRedisClient(config);
      try {
        await new Promise<void>((resolve, reject) => {
          redisClient.once('ready', resolve);
          redisClient.once('error', reject);
          // Timeout after 5 seconds
          setTimeout(() => reject(new Error('Redis connection timeout')), 5000);
        });
      } catch (error) {
        console.error('Failed to connect to Redis:', error);
        return EXIT_REDIS_ERROR;
      }

      publisher = new RedisPublisher(redisClient, config);

      // Register cleanup for Redis
      signalHandler.register(async () => {
        await publisher.close();
      });
    }

    // Create and run process
    const runner = new ProcessRunner(
      adapter,
      options,
      config,
      publisher,
      signalHandler
    );

    // Run the agent
    const exitCode = await runner.run();

    // Close publisher
    await publisher.close();

    return exitCode === 0 ? EXIT_SUCCESS : EXIT_AGENT_ERROR;
  } catch (error) {
    if (error instanceof Error) {
      // Check if it's a CLI argument error
      if (
        error.message.includes('required') ||
        error.message.includes('Invalid') ||
        error.message.includes('Failed to parse')
      ) {
        console.error('Error:', error.message);
        console.error('\nRun with --help for usage information.');
        return EXIT_CLI_ERROR;
      }

      console.error('Error:', error.message);
      if (process.env.ILKKUN_LOG_LEVEL === 'debug') {
        console.error(error.stack);
      }
    } else {
      console.error('An unexpected error occurred:', error);
    }
    return EXIT_GENERAL_ERROR;
  }
}

/**
 * Parse extra arguments string into array
 */
function parseExtraArgs(extraArgs: string): string[] {
  const args: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < extraArgs.length; i++) {
    const char = extraArgs[i];

    if ((char === '"' || char === "'") && !inQuote) {
      inQuote = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuote) {
      inQuote = false;
      quoteChar = '';
    } else if (char === ' ' && !inQuote) {
      if (current) {
        args.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    args.push(current);
  }

  return args;
}

// Run main
main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(EXIT_GENERAL_ERROR);
  });
