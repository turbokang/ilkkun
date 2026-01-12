# ilkkun 기술 명세서

**버전**: 1.0.0
**최종 수정**: 2026-01-12

---

## 1. 개요

**ilkkun**(일꾼)은 여러 AI CLI 에이전트(Claude Code, Gemini CLI, Codex CLI)를 headless 모드로 실행하고, JSON 출력을 Redis 큐에 순차적으로 스트리밍하는 경량 CLI 브릿지이다.

단일 바이너리로 배포되어 외부 의존성 없이 실행 가능하며, 멀티 에이전트 오케스트레이션 시스템의 기반 인프라로 활용된다.

---

## 2. 배경 및 문제 정의

### 2.1 현재 상황
- Claude Code, Gemini CLI, Codex CLI 모두 headless + stream-json 모드 지원
- 각 CLI는 NDJSON(Newline-Delimited JSON) 형태로 실시간 이벤트 출력
- 멀티 에이전트 오케스트레이션을 위해 이 출력을 중앙 큐로 수집 필요

### 2.2 문제점
- 각 CLI마다 출력 포맷이 미묘하게 다름
- 스트림 파싱 + Redis 푸시 로직을 매번 구현해야 함
- Node.js 런타임 의존성으로 배포 복잡

### 2.3 해결책
- 통합 어댑터로 3개 CLI 지원
- 정규화된 이벤트 스키마로 출력 통일
- 단일 바이너리로 의존성 제거

---

## 3. 목표

| ID | 목표 | 성공 기준 |
|----|------|----------|
| G1 | 3개 AI CLI 통합 지원 | Claude, Gemini, Codex 모두 동작 |
| G2 | 실시간 스트리밍 | 첫 청크 수신 후 100ms 내 Redis 푸시 |
| G3 | 단일 바이너리 배포 | npm install 없이 실행 가능 |
| G4 | 정규화된 이벤트 스키마 | 소비자가 에이전트 종류 무관하게 처리 가능 |
| G5 | 환경변수 기반 설정 | 코드 수정 없이 설정 변경 |

---

## 4. 비목표

| ID | 비목표 | 이유 |
|----|--------|------|
| NG1 | 에이전트 응답 후처리/분석 | 소비자 책임 |
| NG2 | 웹 UI 제공 | CLI 도구로 한정 |
| NG3 | 멀티턴 세션 관리 | 오케스트레이터 책임 |
| NG4 | API 키 관리 | 각 CLI의 기존 인증 메커니즘 사용 |
| NG5 | 에이전트 간 라우팅/로드밸런싱 | 호출자 책임 |

---

## 5. 사용자 페르소나

### 5.1 Primary: 백엔드 개발자
- 멀티 에이전트 오케스트레이션 시스템 개발 중
- 다중 에이전트 출력을 Redis로 수집하여 처리
- Docker 컨테이너 환경에서 실행

### 5.2 Secondary: DevOps 엔지니어
- CI/CD 파이프라인에서 AI 에이전트 활용
- 단일 바이너리로 쉬운 배포 원함

### 5.3 Tertiary: AI 에이전트 연구자
- 여러 LLM CLI 출력 비교 분석
- 통일된 포맷으로 로깅 필요

---

## 6. 기능 요구사항

### 6.1 CLI 인터페이스

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR1 | `-a, --agent` 플래그로 에이전트 선택 (claude/gemini/codex) | P0 |
| FR2 | `-p, --prompt` 플래그로 프롬프트 전달 | P0 |
| FR3 | `--session-id` 플래그로 Redis 큐 키 지정 | P0 |
| FR4 | `--cwd` 플래그로 작업 디렉토리 지정 (Codex 필수) | P0 |
| FR5 | `--timeout` 플래그로 최대 실행 시간 지정 | P1 |
| FR6 | `--dry-run` 플래그로 실제 실행 없이 명령어 출력 | P2 |
| FR7 | stdin 파이프 입력 지원 | P1 |
| FR8 | `--version` 플래그로 버전 출력 | P2 |
| FR9 | `--help` 플래그로 도움말 출력 | P0 |

### 6.2 에이전트 어댑터

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR10 | Claude Code: `--dangerously-skip-permissions --output-format stream-json` | P0 |
| FR11 | Gemini CLI: `--yolo --output-format stream-json` | P0 |
| FR12 | Codex CLI: `--yolo --json` (codex exec) | P0 |
| FR13 | 에이전트별 바이너리 경로 환경변수 오버라이드 | P1 |
| FR14 | 에이전트별 추가 플래그 전달 (`--extra-args`) | P2 |

### 6.3 스트림 처리

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR15 | NDJSON 라인 단위 파싱 | P0 |
| FR16 | 부분 라인 버퍼링 (incomplete line handling) | P0 |
| FR17 | 에이전트별 이벤트 → 정규화 이벤트 변환 | P0 |
| FR18 | stderr 캡처 및 에러 이벤트 생성 | P1 |
| FR19 | 프로세스 종료 코드 캡처 | P0 |

### 6.4 Redis 퍼블리싱

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR20 | RPUSH로 순차적 이벤트 푸시 | P0 |
| FR21 | 큐 키 형식: `{prefix}:{session-id}` | P0 |
| FR22 | 선택적 TTL 설정 (EXPIRE) | P1 |
| FR23 | 연결 실패 시 재시도 (최대 3회) | P1 |
| FR24 | 세션 시작/종료 마커 이벤트 푸시 | P0 |
| FR25 | Redis Cluster 지원 | P2 |
| FR26 | Redis Sentinel 지원 | P2 |

### 6.5 에러 핸들링

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR27 | 에이전트 프로세스 실패 시 에러 이벤트 푸시 | P0 |
| FR28 | Redis 연결 실패 시 로컬 파일 폴백 (선택적) | P2 |
| FR29 | 타임아웃 시 SIGTERM → SIGKILL 순차 전송 | P1 |
| FR30 | graceful shutdown (SIGINT/SIGTERM 처리) | P0 |

---

## 7. 비기능 요구사항

### 7.1 성능

| ID | 요구사항 | 목표치 |
|----|----------|--------|
| NFR1 | 이벤트 처리 지연 | < 50ms (파싱 + Redis 푸시) |
| NFR2 | 메모리 사용량 | < 50MB (idle 상태) |
| NFR3 | 바이너리 크기 | < 80MB |
| NFR4 | 시작 시간 | < 500ms |

### 7.2 안정성

| ID | 요구사항 | 목표치 |
|----|----------|--------|
| NFR5 | 크래시 없는 연속 실행 | 24시간 |
| NFR6 | 메모리 누수 없음 | 장시간 실행 시 메모리 안정 |

### 7.3 호환성

| ID | 요구사항 | 목표치 |
|----|----------|--------|
| NFR7 | Linux x64/arm64 | Ubuntu 20.04+ |
| NFR8 | macOS x64/arm64 | macOS 12+ |
| NFR9 | Windows x64 | Windows 10+ (WSL 권장) |
| NFR10 | Redis 버전 | 6.0+ |

### 7.4 보안

| ID | 요구사항 |
|----|----------|
| NFR11 | Redis 인증 지원 (password, ACL) |
| NFR12 | TLS 연결 지원 |
| NFR13 | 프롬프트 내 민감정보 로깅 제외 옵션 |

---

## 8. 기술 스펙

### 8.1 기술 스택

| 영역 | 선택 | 이유 |
|------|------|------|
| 런타임 | **Bun 1.1+** | 단일 바이너리 컴파일, TS 네이티브 |
| 언어 | **TypeScript 5.x** | 타입 안정성 |
| Redis 클라이언트 | **ioredis 5.x** | 안정성, Cluster/Sentinel 지원 |
| CLI 파싱 | **Bun 내장 parseArgs** | 의존성 최소화 |
| 프로세스 관리 | **Bun.spawn** | 스트림 처리 용이 |

### 8.2 지원 에이전트 CLI 버전

| 에이전트 | 최소 버전 | 확인된 버전 |
|----------|----------|------------|
| Claude Code | 1.0.0 | latest |
| Gemini CLI | 1.0.0 | latest |
| Codex CLI | 1.0.0 | latest |

---

## 9. 아키텍처

### 9.1 컴포넌트 다이어그램

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

### 9.2 시퀀스 다이어그램

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

### 9.3 파일 구조

```
ilkkun/
├── src/
│   ├── index.ts              # 진입점
│   ├── cli.ts                # CLI 파싱 및 검증
│   ├── config.ts             # 환경변수 + 설정 관리
│   ├── types.ts              # 공통 타입 정의
│   │
│   ├── adapters/
│   │   ├── index.ts          # 어댑터 팩토리
│   │   ├── base.ts           # AgentAdapter 인터페이스
│   │   ├── claude.ts         # Claude Code 어댑터
│   │   ├── gemini.ts         # Gemini CLI 어댑터
│   │   └── codex.ts          # Codex CLI 어댑터
│   │
│   ├── stream/
│   │   ├── processor.ts      # 스트림 처리 메인
│   │   ├── ndjson-parser.ts  # NDJSON 라인 파서
│   │   └── normalizer.ts     # 이벤트 정규화
│   │
│   ├── redis/
│   │   ├── client.ts         # Redis 연결 관리
│   │   └── publisher.ts      # RPUSH 로직
│   │
│   └── process/
│       ├── runner.ts         # 프로세스 실행
│       └── signal-handler.ts # 시그널 처리
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

## 10. 인터페이스 설계

### 10.1 CLI 인터페이스

```bash
ilkkun [options]

Options:
  -a, --agent <name>       에이전트 선택 (claude|gemini|codex) [필수]
  -p, --prompt <text>      프롬프트 [필수, 또는 stdin 사용]
  -s, --session-id <id>    Redis 큐 키용 세션 ID [기본값: uuid]
  -c, --cwd <path>         작업 디렉토리 [기본값: 현재 디렉토리]
  -t, --timeout <ms>       타임아웃 (밀리초) [기본값: 300000]
  --extra-args <args>      에이전트에 전달할 추가 인자
  --dry-run                실행 없이 명령어 출력
  --no-redis               Redis 대신 stdout으로 출력
  --no-yolo                자동 승인 비활성화 [기본값: 활성화]
  -v, --version            버전 출력
  -h, --help               도움말 출력

Environment:
  REDIS_URL                Redis 연결 URL [기본값: redis://localhost:6379]
  REDIS_QUEUE_PREFIX       큐 키 접두사 [기본값: ilkkun:stream]
  REDIS_QUEUE_TTL          큐 TTL 초 [기본값: 3600]
  ILKKUN_CLAUDE_BIN        Claude CLI 경로 [기본값: claude]
  ILKKUN_GEMINI_BIN        Gemini CLI 경로 [기본값: gemini]
  ILKKUN_CODEX_BIN         Codex CLI 경로 [기본값: codex]
  ILKKUN_DEFAULT_AGENT     기본 에이전트 [기본값: claude]
  ILKKUN_LOG_LEVEL         로그 레벨 (debug|info|warn|error) [기본값: info]

Examples:
  ilkkun -a claude -p "이 코드를 설명해줘"
  ilkkun -a gemini -p "테스트 작성해줘" -s my-session-123
  ilkkun -a codex -p "버그 수정해줘" -c ./my-project
  echo "리뷰해줘" | ilkkun -a claude
  ilkkun -a claude -p "안녕" --no-redis
```

### 10.2 종료 코드

| 코드 | 의미 |
|------|------|
| 0 | 성공 |
| 1 | 일반 에러 |
| 2 | CLI 인자 에러 |
| 3 | 에이전트 실행 실패 |
| 4 | Redis 연결 실패 |
| 5 | 타임아웃 |
| 130 | SIGINT (Ctrl+C) |
| 143 | SIGTERM |

---

## 11. 데이터 모델

### 11.1 정규화 이벤트 스키마

```typescript
interface NormalizedEvent {
  // 메타데이터
  id: string;                           // UUID v4
  source: 'claude' | 'gemini' | 'codex';
  sessionId: string;
  timestamp: number;                    // Unix ms
  sequence: number;                     // 순서 보장용

  // 이벤트 타입
  type: EventType;

  // 페이로드 (타입별 상이)
  payload: EventPayload;

  // 원본 데이터 (디버깅용, 선택적)
  raw?: unknown;
}

type EventType =
  | 'session.start'      // 세션 시작
  | 'session.end'        // 세션 종료
  | 'message.start'      // 메시지 시작
  | 'message.delta'      // 텍스트 청크
  | 'message.end'        // 메시지 종료
  | 'tool.start'         // 도구 호출 시작
  | 'tool.delta'         // 도구 실행 중 출력
  | 'tool.end'           // 도구 호출 종료
  | 'thinking.start'     // 추론 시작
  | 'thinking.delta'     // 추론 중
  | 'thinking.end'       // 추론 종료
  | 'error'              // 에러
  | 'system';            // 시스템 메시지

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

### 11.2 Redis 큐 구조

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

### 11.3 에이전트별 원시 이벤트 매핑

#### Claude Code

| 원시 타입 | 정규화 타입 |
|----------|------------|
| `system` | `system` |
| `assistant` | `message.start` |
| `content_block_start` (text) | `message.delta` |
| `content_block_delta` | `message.delta` |
| `content_block_start` (tool_use) | `tool.start` |
| `content_block_stop` | `tool.end` / `message.end` |
| `result` | `session.end` |

#### Gemini CLI

| 원시 타입 | 정규화 타입 |
|----------|------------|
| `init` | `session.start` |
| `message` | `message.delta` |
| `tool_call` | `tool.start` |
| `tool_result` | `tool.end` |
| `done` | `session.end` |
| `error` | `error` |

#### Codex CLI

| 원시 타입 | 정규화 타입 |
|----------|------------|
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

## 12. 환경변수 상세

| 변수 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `REDIS_URL` | string | `redis://localhost:6379` | Redis 연결 URL |
| `REDIS_QUEUE_PREFIX` | string | `ilkkun:stream` | 큐 키 접두사 |
| `REDIS_QUEUE_TTL` | number | `3600` | 큐 TTL (초, 0=무제한) |
| `REDIS_MAX_RETRIES` | number | `3` | 연결 재시도 횟수 |
| `REDIS_RETRY_DELAY` | number | `1000` | 재시도 대기 (ms) |
| `ILKKUN_CLAUDE_BIN` | string | `claude` | Claude CLI 경로 |
| `ILKKUN_GEMINI_BIN` | string | `gemini` | Gemini CLI 경로 |
| `ILKKUN_CODEX_BIN` | string | `codex` | Codex CLI 경로 |
| `ILKKUN_DEFAULT_AGENT` | string | `claude` | 기본 에이전트 |
| `ILKKUN_DEFAULT_TIMEOUT` | number | `300` | 기본 타임아웃 (초) |
| `ILKKUN_LOG_LEVEL` | string | `info` | 로그 레벨 |
| `ILKKUN_INCLUDE_RAW` | boolean | `false` | 원시 데이터 포함 여부 |

---

## 13. 에러 핸들링

### 13.1 에러 분류

| 분류 | 예시 | 처리 |
|------|------|------|
| 설정 에러 | 잘못된 인자, 환경변수 누락 | 즉시 종료 (exit 2) |
| 에이전트 에러 | CLI 없음, 실행 실패 | 에러 이벤트 푸시 후 종료 (exit 3) |
| Redis 에러 | 연결 실패, 푸시 실패 | 재시도 후 종료 (exit 4) |
| 타임아웃 | 응답 없음 | 프로세스 종료 후 에러 이벤트 (exit 5) |
| 시그널 | SIGINT, SIGTERM | graceful shutdown |

### 13.2 에러 이벤트 예시

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

## 14. 보안 고려사항

### 14.1 위협 모델

| 위협 | 완화 방안 |
|------|----------|
| Redis 무단 접근 | AUTH/ACL, TLS 지원 |
| 프롬프트 인젝션 | 에이전트 책임 (ilkkun은 패스스루) |
| 민감 데이터 노출 | `--no-raw` 옵션, 로그 레벨 조절 |
| 프로세스 하이재킹 | 절대 경로 사용 권장 |

### 14.2 권장 프로덕션 설정

```bash
# 프로덕션 환경
REDIS_URL=rediss://user:pass@redis.internal:6379  # TLS
ILKKUN_LOG_LEVEL=warn
ILKKUN_INCLUDE_RAW=false
ILKKUN_CLAUDE_BIN=/usr/local/bin/claude           # 절대 경로
```

---

## 15. 테스트 전략

### 15.1 단위 테스트

| 모듈 | 테스트 항목 |
|------|------------|
| CLI Parser | 인자 파싱, 검증, 기본값 |
| Config | 환경변수 로드, 오버라이드 |
| Adapters | 명령어 생성, 이벤트 정규화 |
| NDJSON Parser | 라인 파싱, 버퍼링, 에지 케이스 |
| Normalizer | 각 에이전트 이벤트 변환 |

### 15.2 통합 테스트

| 시나리오 | 검증 항목 |
|----------|----------|
| Claude 정상 실행 | 이벤트 순서, 내용 |
| Gemini 정상 실행 | 이벤트 순서, 내용 |
| Codex 정상 실행 | 이벤트 순서, 내용 |
| 타임아웃 | 프로세스 종료, 에러 이벤트 |
| Redis 재연결 | 재시도 로직 |
| 시그널 처리 | graceful shutdown |

### 15.3 E2E 테스트

```bash
# 실제 에이전트 + Redis로 테스트
docker-compose -f docker-compose.test.yml up -d redis
./ilkkun -a claude -p "Say hello" -s test-session
redis-cli LRANGE ilkkun:stream:test-session 0 -1
```

---

## 16. 배포 전략

### 16.1 빌드 매트릭스

| OS | Arch | 빌드 명령 | 아티팩트 |
|----|------|----------|---------|
| Linux | x64 | `bun build --compile --target=bun-linux-x64` | `ilkkun-linux-x64` |
| Linux | arm64 | `bun build --compile --target=bun-linux-arm64` | `ilkkun-linux-arm64` |
| macOS | x64 | `bun build --compile --target=bun-darwin-x64` | `ilkkun-darwin-x64` |
| macOS | arm64 | `bun build --compile --target=bun-darwin-arm64` | `ilkkun-darwin-arm64` |
| Windows | x64 | `bun build --compile --target=bun-windows-x64` | `ilkkun-windows-x64.exe` |

### 16.2 배포 채널

| 채널 | 방식 |
|------|------|
| GitHub Releases | 바이너리 직접 다운로드 |
| npm | `npm install -g ilkkun` (옵션) |
| Docker | `ghcr.io/turbokang/ilkkun:latest` |
| Homebrew | `brew install turbokang/tap/ilkkun` (향후) |

---

## 17. 성공 지표 (KPIs)

| 지표 | 목표 | 측정 방법 |
|------|------|----------|
| 첫 이벤트 지연 | < 100ms | 타임스탬프 비교 |
| 이벤트 손실률 | 0% | 시퀀스 번호 검증 |
| 빌드 성공률 | 100% | CI 통과율 |
| 바이너리 크기 | < 80MB | 빌드 아티팩트 |
| 테스트 커버리지 | > 80% | bun test --coverage |

---

## 18. 리스크 및 완화

| 리스크 | 영향 | 가능성 | 완화 방안 |
|--------|------|--------|----------|
| CLI 출력 포맷 변경 | 높음 | 중간 | 버전 피닝, 어댑터 추상화 |
| Bun 호환성 이슈 | 중간 | 낮음 | Node.js 폴백 준비 |
| Redis 병목 | 중간 | 낮음 | 배치 푸시, 파이프라이닝 |
| 에이전트 API 변경 | 높음 | 중간 | 어댑터 버전 관리 |

---

## 부록

### A. 용어 정의

| 용어 | 정의 |
|------|------|
| 에이전트 | AI CLI 도구 (Claude, Gemini, Codex) |
| 세션 | 단일 프롬프트-응답 사이클 |
| NDJSON | Newline-Delimited JSON |
| 정규화 | 다양한 포맷을 통일된 스키마로 변환 |

### B. 참고 문서

- [Claude Code Documentation](https://docs.anthropic.com/claude-code)
- [Gemini CLI Documentation](https://ai.google.dev/gemini-cli)
- [Codex CLI Documentation](https://platform.openai.com/docs/codex)
