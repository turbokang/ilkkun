/**
 * CLI argument parsing and validation
 */

import { parseArgs } from 'util';
import type { CLIOptions, AgentType } from './types';
import { loadConfig } from './config';

const VERSION = '0.1.0';

/**
 * Parse command-line arguments
 */
export function parseCliArgs(): {
  values: Record<string, unknown>;
  positionals: string[];
} {
  try {
    return parseArgs({
      options: {
        agent: {
          type: 'string',
          short: 'a',
        },
        prompt: {
          type: 'string',
          short: 'p',
        },
        'session-id': {
          type: 'string',
          short: 's',
        },
        cwd: {
          type: 'string',
          short: 'c',
        },
        timeout: {
          type: 'string',
          short: 't',
        },
        'extra-args': {
          type: 'string',
        },
        'dry-run': {
          type: 'boolean',
        },
        'no-yolo': {
          type: 'boolean',
        },
        'no-redis': {
          type: 'boolean',
        },
        version: {
          type: 'boolean',
          short: 'v',
        },
        help: {
          type: 'boolean',
          short: 'h',
        },
      },
      allowPositionals: true,
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse arguments: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Read prompt from stdin if available
 */
export async function readStdin(): Promise<string | null> {
  // Check if stdin is a TTY (interactive terminal)
  // If it is, there's no piped input
  if (process.stdin.isTTY) {
    return null;
  }

  try {
    const reader = Bun.stdin.stream().getReader();
    const chunks: Uint8Array[] = [];
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    if (chunks.length === 0) {
      return null;
    }

    // Combine all chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    return decoder.decode(combined).trim();
  } catch (error) {
    // If reading fails, treat as no stdin
    return null;
  }
}

/**
 * Validate and normalize CLI arguments into CLIOptions
 */
export async function validateArgs(
  args: Record<string, unknown>
): Promise<CLIOptions> {
  const config = loadConfig();

  // Validate agent
  const agentStr = args.agent as string | undefined;
  if (!agentStr) {
    throw new Error(
      'Agent is required. Use -a or --agent to specify one of: claude, gemini, codex'
    );
  }

  const agent = agentStr.toLowerCase();
  const validAgents: AgentType[] = ['claude', 'gemini', 'codex'];
  if (!validAgents.includes(agent as AgentType)) {
    throw new Error(
      `Invalid agent: ${agent}. Must be one of: ${validAgents.join(', ')}`
    );
  }

  // Get prompt from args or stdin
  let prompt = args.prompt as string | undefined;
  if (!prompt) {
    const stdinPrompt = await readStdin();
    if (stdinPrompt) {
      prompt = stdinPrompt;
    }
  }

  if (!prompt) {
    throw new Error(
      'Prompt is required. Use -p or --prompt, or pipe input via stdin'
    );
  }

  // Generate session ID if not provided
  const sessionId =
    (args['session-id'] as string | undefined) || crypto.randomUUID();

  // Set working directory (default to current directory)
  const cwd = (args.cwd as string | undefined) || process.cwd();

  // Parse timeout (convert from seconds to milliseconds)
  let timeout: number;
  if (args.timeout) {
    const timeoutSeconds = Number(args.timeout);
    if (isNaN(timeoutSeconds) || timeoutSeconds < 0) {
      throw new Error(
        `Invalid timeout: ${args.timeout}. Must be a positive number (in seconds)`
      );
    }
    timeout = timeoutSeconds * 1000; // Convert to milliseconds
  } else {
    // Use default timeout from config (already in seconds)
    timeout = config.defaultTimeout * 1000;
  }

  // Get extra args
  const extraArgs = args['extra-args'] as string | undefined;

  // Get flags
  const dryRun = Boolean(args['dry-run']);
  const noYolo = Boolean(args['no-yolo']);
  const noRedis = Boolean(args['no-redis']);

  return {
    agent: agent as AgentType,
    prompt,
    sessionId,
    cwd,
    timeout,
    extraArgs,
    dryRun,
    noYolo,
    noRedis,
  };
}

/**
 * Print help message
 */
export function printHelp(): void {
  console.log(`ilkkun v${VERSION}

Usage: ilkkun [options]

Options:
  -a, --agent <name>       Agent to use (claude|gemini|codex) [required]
  -p, --prompt <text>      Prompt text [required, or use stdin]
  -s, --session-id <id>    Session ID (for Redis queue key) [default: uuid]
  -c, --cwd <path>         Working directory [default: current directory]
  -t, --timeout <seconds>  Timeout in seconds [default: 300]
  --extra-args <args>      Extra arguments to pass to agent
  --dry-run                Print command without executing
  --no-yolo                Disable auto-approval mode
  --no-redis               Output events to stdout instead of Redis (NDJSON)
  -v, --version            Show version
  -h, --help               Show this help

Environment Variables:
  REDIS_URL                Redis connection URL [default: redis://localhost:6379]
  REDIS_QUEUE_PREFIX       Queue key prefix [default: ilkkun:stream]
  REDIS_QUEUE_TTL          Queue TTL in seconds [default: 3600]
  ILKKUN_CLAUDE_BIN        Claude CLI path [default: claude]
  ILKKUN_GEMINI_BIN        Gemini CLI path [default: gemini]
  ILKKUN_CODEX_BIN         Codex CLI path [default: codex]
  ILKKUN_DEFAULT_AGENT     Default agent [default: claude]
  ILKKUN_LOG_LEVEL         Log level (debug|info|warn|error) [default: info]

Examples:
  ilkkun -a claude -p "Explain this code"
  ilkkun -a gemini -p "Write tests" -s my-session-123
  ilkkun -a codex -p "Fix bugs" -c ./my-project
  echo "Review this" | ilkkun -a claude
  cat file.py | ilkkun -a gemini -p "Analyze"
`);
}

/**
 * Print version
 */
export function printVersion(): void {
  console.log(`ilkkun v${VERSION}`);
}
