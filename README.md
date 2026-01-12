# ilkkun

[![CI](https://github.com/turbokang/ilkkun/actions/workflows/ci.yml/badge.svg)](https://github.com/turbokang/ilkkun/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**ilkkun** is a lightweight CLI bridge that executes AI CLI agents (Claude Code, Gemini CLI, Codex CLI) in headless mode and streams their NDJSON output to Redis queues with normalized events.

> **Warning**: This project is currently in an **unstable/experimental state** and is not recommended for production use. Only **Claude Code** adapter has been tested. Gemini CLI and Codex CLI adapters have not been tested by the author and may not work as expected.

[한국어 문서 (Korean)](./README.ko.md)

## Features

- **Multi-Agent Support**: Claude Code, Gemini CLI, and Codex CLI
- **Unified Event Schema**: Normalized events regardless of agent type
- **Real-time Streaming**: Events pushed to Redis within 50ms of receipt
- **Single Binary**: No runtime dependencies required
- **Flexible Output**: Redis queue or stdout (NDJSON)

## Installation

### Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/turbokang/ilkkun/main/install.sh | bash
```

Install a specific version:

```bash
curl -fsSL https://raw.githubusercontent.com/turbokang/ilkkun/main/install.sh | bash -s -- v1.0.0
```

### Manual Installation

Download the binary for your platform from [GitHub Releases](https://github.com/turbokang/ilkkun/releases):

| Platform | Binary |
|----------|--------|
| Linux x64 | `ilkkun-linux-x64` |
| Linux ARM64 | `ilkkun-linux-arm64` |
| macOS x64 | `ilkkun-darwin-x64` |
| macOS ARM64 | `ilkkun-darwin-arm64` |
| Windows x64 | `ilkkun-windows-x64.exe` |

```bash
# Example: macOS ARM64
curl -L https://github.com/turbokang/ilkkun/releases/latest/download/ilkkun-darwin-arm64 -o ilkkun
chmod +x ilkkun
sudo mv ilkkun /usr/local/bin/
```

## Usage

### Basic Commands

```bash
# Execute with Claude and stream to Redis
ilkkun -a claude -p "Explain this code"

# Execute without Redis (output to stdout)
ilkkun -a claude -p "Hello" --no-redis

# Execute with Gemini
ilkkun -a gemini -p "Write unit tests" -s my-session-123

# Execute with Codex
ilkkun -a codex -p "Fix the bug" -c ./project

# Preview command without execution
ilkkun -a claude -p "Hello" --dry-run
```

### CLI Options

```
Options:
  -a, --agent <name>       Agent type (claude|gemini|codex) [required]
  -p, --prompt <text>      Prompt text [required, or use stdin]
  -s, --session-id <id>    Session ID for Redis queue key [default: uuid]
  -c, --cwd <path>         Working directory [default: current directory]
  -t, --timeout <ms>       Timeout in milliseconds [default: 300000]
  --extra-args <args>      Additional arguments for the agent
  --dry-run                Preview command without execution
  --no-redis               Output to stdout instead of Redis
  --no-yolo                Disable auto-approval mode
  -v, --version            Show version
  -h, --help               Show help
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `REDIS_QUEUE_PREFIX` | `ilkkun:stream` | Queue key prefix |
| `REDIS_QUEUE_TTL` | `3600` | Queue TTL in seconds (0 = unlimited) |
| `ILKKUN_CLAUDE_BIN` | `claude` | Path to Claude CLI binary |
| `ILKKUN_GEMINI_BIN` | `gemini` | Path to Gemini CLI binary |
| `ILKKUN_CODEX_BIN` | `codex` | Path to Codex CLI binary |
| `ILKKUN_DEFAULT_AGENT` | `claude` | Default agent type |
| `ILKKUN_LOG_LEVEL` | `info` | Log level (debug\|info\|warn\|error) |

### Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | General error |
| 2 | CLI argument error |
| 3 | Agent execution failure |
| 4 | Redis connection failure |
| 5 | Timeout |

## Event Schema

All agent outputs are normalized to a unified event schema:

```typescript
interface NormalizedEvent {
  id: string;                              // UUID v4
  source: 'claude' | 'gemini' | 'codex';
  sessionId: string;
  timestamp: number;                       // Unix milliseconds
  sequence: number;                        // Order guarantee
  type: EventType;
  payload: EventPayload;
  raw?: unknown;                           // Original data (optional)
}

type EventType =
  | 'session.start' | 'session.end'
  | 'message.start' | 'message.delta' | 'message.end'
  | 'tool.start' | 'tool.delta' | 'tool.end'
  | 'thinking.start' | 'thinking.delta' | 'thinking.end'
  | 'error' | 'system';
```

## Development

### Prerequisites

- [Bun](https://bun.sh/) 1.1+
- Redis 6.0+ (for Redis mode)

### Setup

```bash
git clone https://github.com/turbokang/ilkkun.git
cd ilkkun
bun install
```

### Commands

```bash
# Run in development
bun run src/index.ts -a claude -p "Hello" --no-redis

# Run tests
bun test

# Build binary
bun run build

# Type check
bun run typecheck
```

### Project Structure

```
ilkkun/
├── src/
│   ├── index.ts              # Entry point
│   ├── cli.ts                # CLI parsing
│   ├── config.ts             # Configuration
│   ├── types.ts              # Type definitions
│   ├── adapters/             # Agent adapters
│   ├── stream/               # Stream processing
│   ├── redis/                # Redis publishing
│   └── process/              # Process management
├── tests/
│   └── unit/                 # Unit tests
└── .github/workflows/        # CI/CD
```

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Contributing

Contributions are welcome. Please open an issue or submit a pull request.

---

## Technical Specification

For detailed technical specifications, architecture diagrams, and implementation details, see the [Technical Specification](./docs/SPECIFICATION.md).
