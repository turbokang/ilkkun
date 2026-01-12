# ilkkun Integration Guide

This guide explains how to consume normalized events from the Redis queue that ilkkun pushes to.

## Table of Contents

- [Quick Start](#quick-start)
- [Redis Queue Structure](#redis-queue-structure)
- [Event Schema](#event-schema)
- [Real-World Event Examples](#real-world-event-examples)
- [Event Types](#event-types)
- [Consumer Examples](#consumer-examples)
- [Best Practices](#best-practices)

---

## Quick Start

### 1. Run ilkkun with a known session ID

```bash
ilkkun -a claude -p "Explain recursion" -s my-session-001
```

### 2. Read events from Redis

```bash
# List all events
redis-cli LRANGE ilkkun:stream:my-session-001 0 -1

# Watch for new events (blocking)
redis-cli BLPOP ilkkun:stream:my-session-001 0
```

---

## Redis Queue Structure

### Key Format

```
{prefix}:{session-id}
```

- **Default prefix**: `ilkkun:stream`
- **Session ID**: UUID or custom string passed via `-s` flag

### Example Keys

```
ilkkun:stream:my-session-001
ilkkun:stream:550e8400-e29b-41d4-a716-446655440000
```

### Queue Type

- **Type**: Redis List
- **Push method**: `RPUSH` (append to right)
- **TTL**: Configurable via `REDIS_QUEUE_TTL` (default: 3600 seconds)

---

## Event Schema

Every event follows this normalized structure:

```typescript
interface NormalizedEvent {
  id: string;           // UUID v4 - unique event identifier
  source: string;       // 'claude' | 'gemini' | 'codex'
  sessionId: string;    // Session identifier
  timestamp: number;    // Unix timestamp in milliseconds
  sequence: number;     // Sequential order (0, 1, 2, ...)
  type: string;         // Event type (see below)
  payload: object;      // Type-specific data
  raw?: unknown;        // Original event (if ILKKUN_INCLUDE_RAW=true)
}
```

---

## Real-World Event Examples

Below are actual events from a Claude Code session (with `ILKKUN_INCLUDE_RAW=true`):

### 1. Session Start

```json
{
  "id": "11c71612-9430-4ae4-9761-9f15241617bf",
  "source": "claude",
  "sessionId": "b9ac71f6-2f40-4d5c-a908-fd3bff763d65",
  "timestamp": 1768191622136,
  "sequence": 0,
  "type": "session.start",
  "payload": {}
}
```

### 2. System Event (Rich Metadata)

The system event contains valuable session metadata:

```json
{
  "id": "d436907c-22fc-4f9e-a158-fb78867e7d90",
  "source": "claude",
  "sessionId": "b9ac71f6-2f40-4d5c-a908-fd3bff763d65",
  "timestamp": 1768191623302,
  "sequence": 0,
  "type": "system",
  "payload": {
    "systemMessage": ""
  },
  "raw": {
    "type": "system",
    "subtype": "init",
    "cwd": "/Users/turbo/Development/personal/ilkkun",
    "session_id": "47db2dab-5f49-4ca0-9caa-bf8751bc634d",
    "tools": ["Task", "Bash", "Read", "Edit", "Write", "Grep", "Glob", "..."],
    "model": "claude-sonnet-4-5-20250929",
    "permissionMode": "bypassPermissions",
    "claude_code_version": "2.1.5"
  }
}
```

**Useful raw fields:**
- `model` - Which Claude model is being used
- `tools` - Available tools in this session
- `cwd` - Working directory
- `claude_code_version` - CLI version

### 3. Message Start (Assistant Response)

```json
{
  "id": "56af747d-17d7-4672-a760-2fec60dc3599",
  "source": "claude",
  "sessionId": "b9ac71f6-2f40-4d5c-a908-fd3bff763d65",
  "timestamp": 1768191626102,
  "sequence": 1,
  "type": "message.start",
  "payload": {
    "role": "assistant"
  },
  "raw": {
    "type": "assistant",
    "message": {
      "model": "claude-sonnet-4-5-20250929",
      "id": "msg_01V9r8XVDgrSpN82h7wqptu3",
      "content": [
        {
          "type": "text",
          "text": "I'll enhance the `.gitignore` file for a proper TypeScript project. Let me first check if there's an existing `.gitignore` file."
        }
      ],
      "usage": {
        "input_tokens": 3,
        "cache_creation_input_tokens": 5352,
        "cache_read_input_tokens": 15563,
        "output_tokens": 8
      }
    }
  }
}
```

**Key raw fields:**
- `raw.message.content[].text` - Full message text
- `raw.message.usage` - Token usage breakdown

### 4. Tool Call (Read File)

When Claude calls a tool like `Read`:

```json
{
  "id": "2b141740-54e9-44de-8c3d-388360c8c1a9",
  "source": "claude",
  "sessionId": "b9ac71f6-2f40-4d5c-a908-fd3bff763d65",
  "timestamp": 1768191626556,
  "sequence": 2,
  "type": "message.start",
  "payload": {
    "role": "assistant"
  },
  "raw": {
    "type": "assistant",
    "message": {
      "content": [
        {
          "type": "tool_use",
          "id": "toolu_01EEMkBiNCx3U6VSQu6qC3tr",
          "name": "Read",
          "input": {
            "file_path": "/Users/turbo/Development/personal/ilkkun/.gitignore"
          }
        }
      ]
    }
  }
}
```

### 5. Tool Call (Edit File)

When Claude edits a file:

```json
{
  "id": "0511d8f1-2313-447a-bdc2-2bec936688e9",
  "source": "claude",
  "sessionId": "b9ac71f6-2f40-4d5c-a908-fd3bff763d65",
  "timestamp": 1768191636904,
  "sequence": 5,
  "type": "message.start",
  "payload": {
    "role": "assistant"
  },
  "raw": {
    "type": "assistant",
    "message": {
      "content": [
        {
          "type": "tool_use",
          "id": "toolu_011xzDrGGJHuYKycQuzceBZM",
          "name": "Edit",
          "input": {
            "replace_all": false,
            "file_path": "/Users/turbo/Development/personal/ilkkun/.gitignore",
            "old_string": "# dependencies (bun install)\nnode_modules\n...",
            "new_string": "# dependencies\nnode_modules/\njspm_packages/\n..."
          }
        }
      ]
    }
  }
}
```

### 6. Session End (With Cost & Usage)

The final event contains comprehensive statistics:

```json
{
  "id": "b9ad24d7-2b9c-43dc-aef9-e4a8f4a7d3eb",
  "source": "claude",
  "sessionId": "b9ac71f6-2f40-4d5c-a908-fd3bff763d65",
  "timestamp": 1768191648484,
  "sequence": 8,
  "type": "session.end",
  "payload": {
    "exitCode": 0,
    "durationMs": 27320
  },
  "raw": {
    "type": "result",
    "subtype": "success",
    "is_error": false,
    "duration_ms": 25315,
    "duration_api_ms": 32142,
    "num_turns": 3,
    "result": "Perfect! I've enhanced the `.gitignore` file...",
    "total_cost_usd": 0.10013040000000001,
    "usage": {
      "input_tokens": 15,
      "cache_creation_input_tokens": 7592,
      "cache_read_input_tokens": 57848,
      "output_tokens": 1207
    },
    "modelUsage": {
      "claude-haiku-4-5-20251001": {
        "inputTokens": 126,
        "outputTokens": 290,
        "costUSD": 0.00669615
      },
      "claude-sonnet-4-5-20250929": {
        "inputTokens": 21,
        "outputTokens": 1323,
        "costUSD": 0.09343425
      }
    }
  }
}
```

**Key raw fields:**
- `raw.total_cost_usd` - Total API cost
- `raw.num_turns` - Number of agent turns
- `raw.result` - Final summary text
- `raw.modelUsage` - Per-model breakdown with costs

---

## Event Types

### Session Lifecycle

| Type | Description | Payload |
|------|-------------|---------|
| `session.start` | Agent session started | `{}` |
| `session.end` | Agent session ended | `{ exitCode, durationMs }` |

### Message Events

| Type | Description | Payload |
|------|-------------|---------|
| `message.start` | New message began | `{ role: 'assistant' }` |
| `message.delta` | Text content chunk | `{ content, role? }` |
| `message.end` | Message completed | `{}` |

### Tool Events

| Type | Description | Payload |
|------|-------------|---------|
| `tool.start` | Tool invocation began | `{ toolName, toolId?, toolInput? }` |
| `tool.delta` | Tool execution output | `{ content }` |
| `tool.end` | Tool completed | `{ toolOutput?, toolExitCode? }` |

### Thinking Events (Codex)

| Type | Description | Payload |
|------|-------------|---------|
| `thinking.start` | Reasoning began | `{}` |
| `thinking.delta` | Reasoning content | `{ content }` |
| `thinking.end` | Reasoning completed | `{}` |

### Other Events

| Type | Description | Payload |
|------|-------------|---------|
| `error` | Error occurred | `{ errorCode, errorMessage }` |
| `system` | System message | `{ systemMessage }` |

---

## Consumer Examples

### Node.js / TypeScript (Basic)

```typescript
import Redis from 'ioredis';

interface NormalizedEvent {
  id: string;
  source: 'claude' | 'gemini' | 'codex';
  sessionId: string;
  timestamp: number;
  sequence: number;
  type: string;
  payload: Record<string, unknown>;
  raw?: any;
}

async function consumeEvents(sessionId: string) {
  const redis = new Redis();
  const queueKey = `ilkkun:stream:${sessionId}`;

  // Read all existing events
  const events = await redis.lrange(queueKey, 0, -1);

  for (const eventJson of events) {
    const event: NormalizedEvent = JSON.parse(eventJson);
    handleEvent(event);
  }

  await redis.quit();
}

function handleEvent(event: NormalizedEvent) {
  switch (event.type) {
    case 'session.start':
      console.log(`[${event.source}] Session started`);
      break;

    case 'message.delta':
      // Stream text to UI
      process.stdout.write(event.payload.content as string);
      break;

    case 'tool.start':
      console.log(`\n[Tool] ${event.payload.toolName}`);
      break;

    case 'tool.end':
      console.log(`[Tool Output] ${event.payload.toolOutput}`);
      break;

    case 'session.end':
      console.log(`\n[${event.source}] Session ended (exit: ${event.payload.exitCode})`);
      break;

    case 'error':
      console.error(`[Error] ${event.payload.errorMessage}`);
      break;
  }
}

// Usage
consumeEvents('my-session-001');
```

### Node.js / TypeScript (Rich Display with Raw Data)

This example extracts full message content, tool calls, and session statistics:

```typescript
import Redis from 'ioredis';

interface NormalizedEvent {
  id: string;
  source: 'claude' | 'gemini' | 'codex';
  sessionId: string;
  timestamp: number;
  sequence: number;
  type: string;
  payload: Record<string, unknown>;
  raw?: any;
}

interface SessionStats {
  model?: string;
  tools?: string[];
  totalCost?: number;
  numTurns?: number;
  duration?: number;
  tokenUsage?: {
    input: number;
    output: number;
    cacheRead: number;
  };
}

class SessionConsumer {
  private stats: SessionStats = {};
  private messageBuffer = '';
  private toolCalls: Array<{ name: string; input: any }> = [];

  handleEvent(event: NormalizedEvent) {
    switch (event.type) {
      case 'system':
        this.handleSystem(event);
        break;
      case 'message.start':
        this.handleMessageStart(event);
        break;
      case 'message.delta':
        this.handleMessageDelta(event);
        break;
      case 'session.end':
        this.handleSessionEnd(event);
        break;
    }
  }

  private handleSystem(event: NormalizedEvent) {
    if (event.raw?.model) {
      this.stats.model = event.raw.model;
      this.stats.tools = event.raw.tools;
      console.log(`\n📦 Model: ${event.raw.model}`);
      console.log(`🔧 Tools: ${event.raw.tools?.length} available`);
      console.log(`📁 CWD: ${event.raw.cwd}\n`);
    }
  }

  private handleMessageStart(event: NormalizedEvent) {
    const content = event.raw?.message?.content;
    if (!content) return;

    for (const block of content) {
      if (block.type === 'text') {
        // Assistant text message
        console.log(`\n💬 ${block.text}`);
      } else if (block.type === 'tool_use') {
        // Tool call
        this.toolCalls.push({ name: block.name, input: block.input });
        console.log(`\n🔧 Tool: ${block.name}`);

        // Show relevant tool input
        if (block.name === 'Read') {
          console.log(`   📄 Reading: ${block.input.file_path}`);
        } else if (block.name === 'Edit') {
          console.log(`   ✏️  Editing: ${block.input.file_path}`);
        } else if (block.name === 'Write') {
          console.log(`   📝 Writing: ${block.input.file_path}`);
        } else if (block.name === 'Bash') {
          console.log(`   $ ${block.input.command}`);
        }
      }
    }
  }

  private handleMessageDelta(event: NormalizedEvent) {
    const content = event.payload.content as string;
    if (content) {
      this.messageBuffer += content;
      process.stdout.write(content);
    }
  }

  private handleSessionEnd(event: NormalizedEvent) {
    const raw = event.raw;
    if (!raw) return;

    console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Session Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (raw.total_cost_usd) {
      console.log(`💰 Cost: $${raw.total_cost_usd.toFixed(4)}`);
    }

    if (raw.num_turns) {
      console.log(`🔄 Turns: ${raw.num_turns}`);
    }

    if (raw.duration_ms) {
      console.log(`⏱️  Duration: ${(raw.duration_ms / 1000).toFixed(1)}s`);
    }

    if (raw.usage) {
      const u = raw.usage;
      console.log(`📈 Tokens: ${u.input_tokens} in / ${u.output_tokens} out`);
      if (u.cache_read_input_tokens) {
        console.log(`   Cache: ${u.cache_read_input_tokens} read`);
      }
    }

    // Per-model breakdown
    if (raw.modelUsage) {
      console.log('\n📦 Model Usage:');
      for (const [model, usage] of Object.entries(raw.modelUsage) as any) {
        console.log(`   ${model}:`);
        console.log(`     Tokens: ${usage.inputTokens} in / ${usage.outputTokens} out`);
        console.log(`     Cost: $${usage.costUSD.toFixed(4)}`);
      }
    }

    console.log(`\n🔧 Tool Calls: ${this.toolCalls.length}`);
    for (const tool of this.toolCalls) {
      console.log(`   - ${tool.name}`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
}

// Usage
async function main() {
  const redis = new Redis();
  const sessionId = process.argv[2] || 'my-session-001';
  const queueKey = `ilkkun:stream:${sessionId}`;

  const events = await redis.lrange(queueKey, 0, -1);
  const consumer = new SessionConsumer();

  for (const eventJson of events) {
    const event: NormalizedEvent = JSON.parse(eventJson);
    consumer.handleEvent(event);
  }

  await redis.quit();
}

main();
```

**Example output:**
```
📦 Model: claude-sonnet-4-5-20250929
🔧 Tools: 17 available
📁 CWD: /Users/turbo/Development/personal/ilkkun

💬 I'll enhance the `.gitignore` file for a proper TypeScript project.

🔧 Tool: Read
   📄 Reading: /Users/turbo/Development/personal/ilkkun/.gitignore

🔧 Tool: Edit
   ✏️  Editing: /Users/turbo/Development/personal/ilkkun/.gitignore

💬 Perfect! I've enhanced the `.gitignore` file...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Session Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Cost: $0.1001
🔄 Turns: 3
⏱️  Duration: 25.3s
📈 Tokens: 15 in / 1207 out
   Cache: 57848 read

📦 Model Usage:
   claude-sonnet-4-5-20250929:
     Tokens: 21 in / 1323 out
     Cost: $0.0934
🔧 Tool Calls: 2
   - Read
   - Edit
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Real-time Streaming Consumer

```typescript
import Redis from 'ioredis';

async function streamEvents(sessionId: string) {
  const redis = new Redis();
  const queueKey = `ilkkun:stream:${sessionId}`;

  let lastIndex = 0;

  while (true) {
    // Get new events since last check
    const events = await redis.lrange(queueKey, lastIndex, -1);

    for (const eventJson of events) {
      const event = JSON.parse(eventJson);
      handleEvent(event);
      lastIndex++;

      // Stop on session end
      if (event.type === 'session.end') {
        await redis.quit();
        return;
      }
    }

    // Poll interval
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
```

### Python

```python
import redis
import json

def consume_events(session_id: str):
    r = redis.Redis()
    queue_key = f"ilkkun:stream:{session_id}"

    # Read all events
    events = r.lrange(queue_key, 0, -1)

    for event_json in events:
        event = json.loads(event_json)
        handle_event(event)

def handle_event(event: dict):
    event_type = event['type']
    payload = event['payload']

    if event_type == 'message.delta':
        print(payload.get('content', ''), end='', flush=True)
    elif event_type == 'tool.start':
        print(f"\n[Tool: {payload.get('toolName')}]")
    elif event_type == 'session.end':
        print(f"\n[Done in {payload.get('durationMs')}ms]")
    elif event_type == 'error':
        print(f"[Error: {payload.get('errorMessage')}]")

# Usage
consume_events('my-session-001')
```

### Go

```go
package main

import (
    "context"
    "encoding/json"
    "fmt"
    "github.com/redis/go-redis/v9"
)

type NormalizedEvent struct {
    ID        string                 `json:"id"`
    Source    string                 `json:"source"`
    SessionID string                 `json:"sessionId"`
    Timestamp int64                  `json:"timestamp"`
    Sequence  int                    `json:"sequence"`
    Type      string                 `json:"type"`
    Payload   map[string]interface{} `json:"payload"`
}

func consumeEvents(sessionID string) {
    ctx := context.Background()
    rdb := redis.NewClient(&redis.Options{Addr: "localhost:6379"})

    queueKey := fmt.Sprintf("ilkkun:stream:%s", sessionID)
    events, _ := rdb.LRange(ctx, queueKey, 0, -1).Result()

    for _, eventJSON := range events {
        var event NormalizedEvent
        json.Unmarshal([]byte(eventJSON), &event)
        handleEvent(event)
    }
}

func handleEvent(event NormalizedEvent) {
    switch event.Type {
    case "message.delta":
        fmt.Print(event.Payload["content"])
    case "session.end":
        fmt.Printf("\n[Done: exit %v]\n", event.Payload["exitCode"])
    case "error":
        fmt.Printf("[Error: %v]\n", event.Payload["errorMessage"])
    }
}
```

### Bash / CLI

```bash
#!/bin/bash

SESSION_ID="my-session-001"
QUEUE_KEY="ilkkun:stream:${SESSION_ID}"

# Read all events and format output
redis-cli LRANGE "$QUEUE_KEY" 0 -1 | while read -r event; do
  type=$(echo "$event" | jq -r '.type')

  case "$type" in
    "message.delta")
      echo -n "$(echo "$event" | jq -r '.payload.content')"
      ;;
    "tool.start")
      echo -e "\n[Tool: $(echo "$event" | jq -r '.payload.toolName')]"
      ;;
    "session.end")
      echo -e "\n[Done: exit $(echo "$event" | jq -r '.payload.exitCode')]"
      ;;
    "error")
      echo "[Error: $(echo "$event" | jq -r '.payload.errorMessage')]"
      ;;
  esac
done
```

---

## Best Practices

### 1. Use Sequence Numbers

Events include a `sequence` field for ordering. Use it to ensure correct order:

```typescript
events.sort((a, b) => a.sequence - b.sequence);
```

### 2. Handle Reconnection

If your consumer disconnects, track the last processed sequence:

```typescript
let lastSequence = getLastProcessedSequence(); // From your storage
const events = await redis.lrange(queueKey, lastSequence + 1, -1);
```

### 3. Set Appropriate TTL

Events are stored with TTL (default 1 hour). Adjust based on your needs:

```bash
export REDIS_QUEUE_TTL=7200  # 2 hours
```

### 4. Monitor Queue Length

For long-running sessions, monitor queue size:

```bash
redis-cli LLEN ilkkun:stream:my-session-001
```

### 5. Use BLPOP for Real-time

For real-time consumption with blocking:

```typescript
// Blocks until new event arrives (with 30s timeout)
const result = await redis.blpop(queueKey, 30);
if (result) {
  const [key, eventJson] = result;
  handleEvent(JSON.parse(eventJson));
}
```

> **Warning**: BLPOP removes the event from the list. Use only when you don't need to replay events.

### 6. Aggregate Text Content

For displaying messages, aggregate `message.delta` events:

```typescript
let messageBuffer = '';

function handleEvent(event: NormalizedEvent) {
  if (event.type === 'message.delta') {
    messageBuffer += event.payload.content || '';
  } else if (event.type === 'message.end') {
    displayMessage(messageBuffer);
    messageBuffer = '';
  }
}
```

---

## Debugging

### View Raw Events

```bash
# Pretty print all events
redis-cli LRANGE ilkkun:stream:my-session-001 0 -1 | jq '.'

# Count events
redis-cli LLEN ilkkun:stream:my-session-001

# Get first event
redis-cli LINDEX ilkkun:stream:my-session-001 0 | jq '.'

# Get last event
redis-cli LINDEX ilkkun:stream:my-session-001 -1 | jq '.'
```

### Include Raw Events

To debug adapter normalization, enable raw event inclusion:

```bash
export ILKKUN_INCLUDE_RAW=true
ilkkun -a claude -p "test"
```

Events will include the original agent output in the `raw` field.

---

## Related

- [README.md](./README.md) - Full PRD and architecture
- [Claude Code Headless Mode](https://docs.anthropic.com/claude-code)
- [ioredis Documentation](https://github.com/redis/ioredis)
