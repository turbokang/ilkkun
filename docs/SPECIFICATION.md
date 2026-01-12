# ilkkun Technical Specification

**Version**: 1.0.0
**Last Updated**: 2026-01-12

---

## 1. Executive Summary

**ilkkun** is a lightweight CLI bridge that executes multiple AI CLI agents (Claude Code, Gemini CLI, Codex CLI) in headless mode and streams their JSON output to Redis queues sequentially.

Distributed as a single binary with no external dependencies, it serves as foundational infrastructure for multi-agent orchestration systems.

---

## 2. Background and Problem Definition

### 2.1 Current Situation
- Claude Code, Gemini CLI, and Codex CLI all support headless + stream-json mode
- Each CLI outputs real-time events in NDJSON (Newline-Delimited JSON) format
- Multi-agent orchestration requires collecting this output into a central queue

### 2.2 Problems
- Each CLI has slightly different output formats
- Stream parsing + Redis push logic must be implemented repeatedly
- Node.js runtime dependency complicates deployment

### 2.3 Solution
- Unified adapter supporting all 3 CLIs
- Normalized event schema for consistent output
- Single binary eliminates dependencies

---

## 3. Goals

| ID | Goal | Success Criteria |
|----|------|------------------|
| G1 | Support 3 AI CLIs | Claude, Gemini, Codex all functional |
| G2 | Real-time streaming | Redis push within 100ms of first chunk |
| G3 | Single binary deployment | Executable without npm install |
| G4 | Normalized event schema | Consumers can process regardless of agent type |
| G5 | Environment-based configuration | Settings changeable without code modification |

---

## 4. Non-Goals

| ID | Non-Goal | Reason |
|----|----------|--------|
| NG1 | Agent response post-processing/analysis | Consumer responsibility |
| NG2 | Web UI | Limited to CLI tool |
| NG3 | Multi-turn session management | Orchestrator responsibility |
| NG4 | API key management | Uses each CLI's existing auth mechanism |
| NG5 | Agent routing/load balancing | Caller responsibility |

---

## 5. User Personas

### 5.1 Primary: Backend Developer
- Building multi-agent orchestration systems
- Collecting multi-agent output via Redis for processing
- Running in Docker container environments

### 5.2 Secondary: DevOps Engineer
- Utilizing AI agents in CI/CD pipelines
- Wants easy deployment via single binary

### 5.3 Tertiary: AI Agent Researcher
- Comparing outputs from multiple LLM CLIs
- Needs unified format for logging

---

## 6. Functional Requirements

### 6.1 CLI Interface

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | `-a, --agent` flag for agent selection (claude/gemini/codex) | P0 |
| FR2 | `-p, --prompt` flag for prompt delivery | P0 |
| FR3 | `--session-id` flag for Redis queue key | P0 |
| FR4 | `--cwd` flag for working directory (required for Codex) | P0 |
| FR5 | `--timeout` flag for maximum execution time | P1 |
| FR6 | `--dry-run` flag to output command without execution | P2 |
| FR7 | stdin pipe input support | P1 |
| FR8 | `--version` flag for version output | P2 |
| FR9 | `--help` flag for help output | P0 |

### 6.2 Agent Adapters

| ID | Requirement | Priority |
|----|-------------|----------|
| FR10 | Claude Code: `--dangerously-skip-permissions --output-format stream-json` | P0 |
| FR11 | Gemini CLI: `--yolo --output-format stream-json` | P0 |
| FR12 | Codex CLI: `--yolo --json` (codex exec) | P0 |
| FR13 | Per-agent binary path override via environment variable | P1 |
| FR14 | Per-agent additional flags (`--extra-args`) | P2 |

### 6.3 Stream Processing

| ID | Requirement | Priority |
|----|-------------|----------|
| FR15 | NDJSON line-by-line parsing | P0 |
| FR16 | Partial line buffering (incomplete line handling) | P0 |
| FR17 | Per-agent event → normalized event conversion | P0 |
| FR18 | stderr capture and error event generation | P1 |
| FR19 | Process exit code capture | P0 |

### 6.4 Redis Publishing

| ID | Requirement | Priority |
|----|-------------|----------|
| FR20 | Sequential event push via RPUSH | P0 |
| FR21 | Queue key format: `{prefix}:{session-id}` | P0 |
| FR22 | Optional TTL setting (EXPIRE) | P1 |
| FR23 | Retry on connection failure (max 3 attempts) | P1 |
| FR24 | Session start/end marker event push | P0 |
| FR25 | Redis Cluster support | P2 |
| FR26 | Redis Sentinel support | P2 |

### 6.5 Error Handling

| ID | Requirement | Priority |
|----|-------------|----------|
| FR27 | Push error event on agent process failure | P0 |
| FR28 | Local file fallback on Redis connection failure (optional) | P2 |
| FR29 | Sequential SIGTERM → SIGKILL on timeout | P1 |
| FR30 | Graceful shutdown (SIGINT/SIGTERM handling) | P0 |

---

## 7. Non-Functional Requirements

### 7.1 Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR1 | Event processing latency | < 50ms (parsing + Redis push) |
| NFR2 | Memory usage | < 50MB (idle state) |
| NFR3 | Binary size | < 80MB |
| NFR4 | Startup time | < 500ms |

### 7.2 Reliability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR5 | Continuous execution without crash | 24 hours |
| NFR6 | No memory leaks | Stable memory during long-running execution |

### 7.3 Compatibility

| ID | Requirement | Target |
|----|-------------|--------|
| NFR7 | Linux x64/arm64 | Ubuntu 20.04+ |
| NFR8 | macOS x64/arm64 | macOS 12+ |
| NFR9 | Windows x64 | Windows 10+ (WSL recommended) |
| NFR10 | Redis version | 6.0+ |

### 7.4 Security

| ID | Requirement |
|----|-------------|
| NFR11 | Redis authentication support (password, ACL) |
| NFR12 | TLS connection support |
| NFR13 | Option to exclude sensitive prompt data from logging |

---

## 8. Technical Specifications

### 8.1 Technology Stack

| Area | Choice | Reason |
|------|--------|--------|
| Runtime | **Bun 1.1+** | Single binary compilation, native TS |
| Language | **TypeScript 5.x** | Type safety |
| Redis Client | **ioredis 5.x** | Stability, Cluster/Sentinel support |
| CLI Parsing | **Bun built-in parseArgs** | Minimize dependencies |
| Process Management | **Bun.spawn** | Easy stream handling |

### 8.2 Supported Agent CLI Versions

| Agent | Minimum Version | Verified Version |
|-------|-----------------|------------------|
| Claude Code | 1.0.0 | latest |
| Gemini CLI | 1.0.0 | latest |
| Codex CLI | 1.0.0 | latest |

---

## 9. Architecture

### 9.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                            ilkkun                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │   CLI        │    │  Agent Adapter   │    │  Stream          │  │
│  │   Parser     │───▶│  Factory         │───▶│  Processor       │  │
│  │              │    │                  │    │                  │  │
│  │  - parseArgs │    │  - Claude        │    │  - NDJSON Parse  │  │
│  │  - validate  │    │  - Gemini        │    │  - Normalize     │  │
│  │              │    │  - Codex         │    │  - Buffer        │  │
│  └──────────────┘    └──────────────────┘    └────────┬─────────┘  │
│                                                        │            │
│                                                        ▼            │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │   Config     │    │  Process         │    │  Redis           │  │
│  │   Manager    │───▶│  Manager         │───▶│  Publisher       │  │
│  │              │    │                  │    │                  │  │
│  │  - env vars  │    │  - spawn         │    │  - RPUSH         │  │
│  │  - defaults  │    │  - signal handle │    │  - reconnect     │  │
│  │              │    │  - timeout       │    │  - TTL           │  │
│  └──────────────┘    └──────────────────┘    └──────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────┐
                    │      Redis Queue         │
                    │  ilkkun:stream:{session} │
                    └──────────────────────────┘
```

### 9.2 Sequence Diagram

```
┌──────┐     ┌────────┐     ┌─────────┐     ┌───────┐     ┌───────┐
│ User │     │ ilkkun │     │ Adapter │     │ Agent │     │ Redis │
└──┬───┘     └───┬────┘     └────┬────┘     └───┬───┘     └───┬───┘
   │             │               │              │             │
   │ run cmd     │               │              │             │
   │────────────▶│               │              │             │
   │             │ get adapter   │              │             │
   │             │──────────────▶│              │             │
   │             │               │              │             │
   │             │ build cmd     │              │             │
   │             │◀──────────────│              │             │
   │             │               │              │             │
   │             │ push init event              │             │
   │             │───────────────────────────────────────────▶│
   │             │               │              │             │
   │             │ spawn         │              │             │
   │             │─────────────────────────────▶│             │
   │             │               │              │             │
   │             │               │    stream    │             │
   │             │◀─────────────────────────────│             │
   │             │               │   (NDJSON)   │             │
   │             │               │              │             │
   │             │ normalize     │              │             │
   │             │──────────────▶│              │             │
   │             │◀──────────────│              │             │
   │             │               │              │             │
   │             │ RPUSH event   │              │             │
   │             │───────────────────────────────────────────▶│
   │             │               │              │             │
   │             │        (repeat for each chunk)             │
   │             │               │              │             │
   │             │               │   exit(0)    │             │
   │             │◀─────────────────────────────│             │
   │             │               │              │             │
   │             │ push done event              │             │
   │             │───────────────────────────────────────────▶│
   │             │               │              │             │
   │ exit(0)     │               │              │             │
   │◀────────────│               │              │             │
   │             │               │              │             │
```

### 9.3 File Structure

```
ilkkun/
├── src/
│   ├── index.ts              # Entry point
│   ├── cli.ts                # CLI parsing and validation
│   ├── config.ts             # Environment + configuration
│   ├── types.ts              # Common type definitions
│   │
│   ├── adapters/
│   │   ├── index.ts          # Adapter factory
│   │   ├── base.ts           # AgentAdapter interface
│   │   ├── claude.ts         # Claude Code adapter
│   │   ├── gemini.ts         # Gemini CLI adapter
│   │   └── codex.ts          # Codex CLI adapter
│   │
│   ├── stream/
│   │   ├── processor.ts      # Stream processing main
│   │   ├── ndjson-parser.ts  # NDJSON line parser
│   │   └── normalizer.ts     # Event normalization
│   │
│   ├── redis/
│   │   ├── client.ts         # Redis connection management
│   │   └── publisher.ts      # RPUSH logic
│   │
│   └── process/
│       ├── runner.ts         # Process execution
│       └── signal-handler.ts # Signal handling
│
├── tests/
│   ├── unit/
│   │   ├── adapters.test.ts
│   │   ├── ndjson-parser.test.ts
│   │   └── cli.test.ts
│   │
│   └── integration/
│       ├── claude.test.ts
│       ├── gemini.test.ts
│       └── codex.test.ts
│
├── .github/workflows/
│   ├── ci.yml
│   └── release.yml
│
├── package.json
├── tsconfig.json
└── README.md
```

---

## 10. Interface Design

### 10.1 CLI Interface

```bash
ilkkun [options]

Options:
  -a, --agent <name>       Select agent (claude|gemini|codex) [required]
  -p, --prompt <text>      Prompt [required, or use stdin]
  -s, --session-id <id>    Session ID for Redis queue key [default: uuid]
  -c, --cwd <path>         Working directory [default: current directory]
  -t, --timeout <ms>       Timeout in milliseconds [default: 300000]
  --extra-args <args>      Additional arguments for agent
  --dry-run                Output command without execution
  --no-redis               Output to stdout instead of Redis
  --no-yolo                Disable auto-approval [default: enabled]
  -v, --version            Show version
  -h, --help               Show help

Environment:
  REDIS_URL                Redis connection URL [default: redis://localhost:6379]
  REDIS_QUEUE_PREFIX       Queue key prefix [default: ilkkun:stream]
  REDIS_QUEUE_TTL          Queue TTL seconds [default: 3600]
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
  ilkkun -a claude -p "Hello" --no-redis
```

### 10.2 Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | CLI argument error |
| 3 | Agent execution failure |
| 4 | Redis connection failure |
| 5 | Timeout |
| 130 | SIGINT (Ctrl+C) |
| 143 | SIGTERM |

---

## 11. Data Model

### 11.1 Normalized Event Schema

```typescript
interface NormalizedEvent {
  // Metadata
  id: string;                           // UUID v4
  source: 'claude' | 'gemini' | 'codex';
  sessionId: string;
  timestamp: number;                    // Unix ms
  sequence: number;                     // Order guarantee

  // Event type
  type: EventType;

  // Payload (varies by type)
  payload: EventPayload;

  // Original data (for debugging, optional)
  raw?: unknown;
}

type EventType =
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

interface EventPayload {
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
```

### 11.2 Redis Queue Structure

```
Key: {prefix}:{session-id}
Type: List
TTL: {ttl} seconds

Example:
  Key: ilkkun:stream:abc-123-def
  Values: [
    '{"id":"...","type":"session.start",...}',
    '{"id":"...","type":"message.delta","payload":{"content":"Hello"},...}',
    '{"id":"...","type":"message.delta","payload":{"content":" World"},...}',
    '{"id":"...","type":"tool.start","payload":{"toolName":"bash"},...}',
    '{"id":"...","type":"tool.end",...}',
    '{"id":"...","type":"session.end","payload":{"exitCode":0},...}'
  ]
```

### 11.3 Agent Raw Event Mapping

#### Claude Code

| Raw Type | Normalized Type |
|----------|-----------------|
| `system` | `system` |
| `assistant` | `message.start` |
| `content_block_start` (text) | `message.delta` |
| `content_block_delta` | `message.delta` |
| `content_block_start` (tool_use) | `tool.start` |
| `content_block_stop` | `tool.end` / `message.end` |
| `result` | `session.end` |

#### Gemini CLI

| Raw Type | Normalized Type |
|----------|-----------------|
| `init` | `session.start` |
| `message` | `message.delta` |
| `tool_call` | `tool.start` |
| `tool_result` | `tool.end` |
| `done` | `session.end` |
| `error` | `error` |

#### Codex CLI

| Raw Type | Normalized Type |
|----------|-----------------|
| `thread.started` | `session.start` |
| `turn.started` | `message.start` |
| `item.message` | `message.delta` |
| `item.reasoning` | `thinking.delta` |
| `item.command_execution` | `tool.start` → `tool.end` |
| `item.file_change` | `tool.start` → `tool.end` |
| `turn.completed` | `message.end` |
| `turn.failed` | `error` |
| `error` | `error` |

---

## 12. Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `REDIS_URL` | string | `redis://localhost:6379` | Redis connection URL |
| `REDIS_QUEUE_PREFIX` | string | `ilkkun:stream` | Queue key prefix |
| `REDIS_QUEUE_TTL` | number | `3600` | Queue TTL (seconds, 0=unlimited) |
| `REDIS_MAX_RETRIES` | number | `3` | Connection retry count |
| `REDIS_RETRY_DELAY` | number | `1000` | Retry delay (ms) |
| `ILKKUN_CLAUDE_BIN` | string | `claude` | Claude CLI path |
| `ILKKUN_GEMINI_BIN` | string | `gemini` | Gemini CLI path |
| `ILKKUN_CODEX_BIN` | string | `codex` | Codex CLI path |
| `ILKKUN_DEFAULT_AGENT` | string | `claude` | Default agent |
| `ILKKUN_DEFAULT_TIMEOUT` | number | `300` | Default timeout (seconds) |
| `ILKKUN_LOG_LEVEL` | string | `info` | Log level |
| `ILKKUN_INCLUDE_RAW` | boolean | `false` | Include raw data |

---

## 13. Error Handling

### 13.1 Error Classification

| Category | Example | Handling |
|----------|---------|----------|
| Configuration error | Invalid argument, missing env var | Immediate exit (exit 2) |
| Agent error | CLI not found, execution failure | Push error event then exit (exit 3) |
| Redis error | Connection failure, push failure | Retry then exit (exit 4) |
| Timeout | No response | Terminate process, push error event (exit 5) |
| Signal | SIGINT, SIGTERM | Graceful shutdown |

### 13.2 Error Event Example

```json
{
  "id": "evt_abc123",
  "source": "claude",
  "sessionId": "session-456",
  "timestamp": 1704067200000,
  "sequence": 15,
  "type": "error",
  "payload": {
    "errorCode": "AGENT_CRASHED",
    "errorMessage": "Process exited with code 1: SIGKILL"
  }
}
```

---

## 14. Security Considerations

### 14.1 Threat Model

| Threat | Mitigation |
|--------|------------|
| Unauthorized Redis access | AUTH/ACL, TLS support |
| Prompt injection | Agent responsibility (ilkkun is pass-through) |
| Sensitive data exposure | `--no-raw` option, log level control |
| Process hijacking | Recommend absolute paths |

### 14.2 Recommended Production Settings

```bash
# Production environment
REDIS_URL=rediss://user:pass@redis.internal:6379  # TLS
ILKKUN_LOG_LEVEL=warn
ILKKUN_INCLUDE_RAW=false
ILKKUN_CLAUDE_BIN=/usr/local/bin/claude           # Absolute path
```

---

## 15. Testing Strategy

### 15.1 Unit Tests

| Module | Test Items |
|--------|------------|
| CLI Parser | Argument parsing, validation, defaults |
| Config | Environment variable loading, overrides |
| Adapters | Command generation, event normalization |
| NDJSON Parser | Line parsing, buffering, edge cases |
| Normalizer | Each agent event conversion |

### 15.2 Integration Tests

| Scenario | Verification |
|----------|--------------|
| Claude normal execution | Event order, content |
| Gemini normal execution | Event order, content |
| Codex normal execution | Event order, content |
| Timeout | Process termination, error event |
| Redis reconnection | Retry logic |
| Signal handling | Graceful shutdown |

### 15.3 E2E Tests

```bash
# Test with actual agent + Redis
docker-compose -f docker-compose.test.yml up -d redis
./ilkkun -a claude -p "Say hello" -s test-session
redis-cli LRANGE ilkkun:stream:test-session 0 -1
```

---

## 16. Deployment Strategy

### 16.1 Build Matrix

| OS | Arch | Build Command | Artifact |
|----|------|---------------|----------|
| Linux | x64 | `bun build --compile --target=bun-linux-x64` | `ilkkun-linux-x64` |
| Linux | arm64 | `bun build --compile --target=bun-linux-arm64` | `ilkkun-linux-arm64` |
| macOS | x64 | `bun build --compile --target=bun-darwin-x64` | `ilkkun-darwin-x64` |
| macOS | arm64 | `bun build --compile --target=bun-darwin-arm64` | `ilkkun-darwin-arm64` |
| Windows | x64 | `bun build --compile --target=bun-windows-x64` | `ilkkun-windows-x64.exe` |

### 16.2 Distribution Channels

| Channel | Method |
|---------|--------|
| GitHub Releases | Direct binary download |
| npm | `npm install -g ilkkun` (optional) |
| Docker | `ghcr.io/turbokang/ilkkun:latest` |
| Homebrew | `brew install turbokang/tap/ilkkun` (future) |

---

## 17. Success Metrics (KPIs)

| Metric | Target | Measurement |
|--------|--------|-------------|
| First event latency | < 100ms | Timestamp comparison |
| Event loss rate | 0% | Sequence number verification |
| Build success rate | 100% | CI pass rate |
| Binary size | < 80MB | Build artifact |
| Test coverage | > 80% | bun test --coverage |

---

## 18. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| CLI output format change | High | Medium | Version pinning, adapter abstraction |
| Bun compatibility issues | Medium | Low | Node.js fallback preparation |
| Redis bottleneck | Medium | Low | Batch push, pipelining |
| Agent API changes | High | Medium | Adapter version management |

---

## Appendix

### A. Terminology

| Term | Definition |
|------|------------|
| Agent | AI CLI tool (Claude, Gemini, Codex) |
| Session | Single prompt-response cycle |
| NDJSON | Newline-Delimited JSON |
| Normalization | Converting various formats to unified schema |

### B. References

- [Claude Code Documentation](https://docs.anthropic.com/claude-code)
- [Gemini CLI Documentation](https://ai.google.dev/gemini-cli)
- [Codex CLI Documentation](https://platform.openai.com/docs/codex)
