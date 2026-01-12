# ilkkun (일꾼)

[![CI](https://github.com/turbokang/ilkkun/actions/workflows/ci.yml/badge.svg)](https://github.com/turbokang/ilkkun/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**ilkkun**(일꾼)은 여러 AI CLI 에이전트(Claude Code, Gemini CLI, Codex CLI)를 headless 모드로 실행하고, NDJSON 출력을 Redis 큐에 정규화된 이벤트로 스트리밍하는 경량 CLI 브릿지입니다.

> **주의**: 이 프로젝트는 현재 **불안정/실험적 상태**이며 프로덕션 사용을 권장하지 않습니다. **Claude Code** 어댑터만 테스트되었습니다. Gemini CLI와 Codex CLI 어댑터는 저자도 아직 테스트하지 않았으며 예상대로 동작하지 않을 수 있습니다.

[English Documentation](./README.md)

## 주요 기능

- **멀티 에이전트 지원**: Claude Code, Gemini CLI, Codex CLI
- **통합 이벤트 스키마**: 에이전트 종류와 무관하게 정규화된 이벤트
- **실시간 스트리밍**: 수신 후 50ms 이내에 Redis로 푸시
- **단일 바이너리**: 런타임 의존성 불필요
- **유연한 출력**: Redis 큐 또는 stdout (NDJSON)

## 설치

### 빠른 설치

```bash
curl -fsSL https://raw.githubusercontent.com/turbokang/ilkkun/main/install.sh | bash
```

특정 버전 설치:

```bash
curl -fsSL https://raw.githubusercontent.com/turbokang/ilkkun/main/install.sh | bash -s -- v1.0.0
```

### 수동 설치

[GitHub Releases](https://github.com/turbokang/ilkkun/releases)에서 플랫폼에 맞는 바이너리를 다운로드하세요:

| 플랫폼 | 바이너리 |
|--------|----------|
| Linux x64 | `ilkkun-linux-x64` |
| Linux ARM64 | `ilkkun-linux-arm64` |
| macOS x64 | `ilkkun-darwin-x64` |
| macOS ARM64 | `ilkkun-darwin-arm64` |
| Windows x64 | `ilkkun-windows-x64.exe` |

```bash
# 예시: macOS ARM64
curl -L https://github.com/turbokang/ilkkun/releases/latest/download/ilkkun-darwin-arm64 -o ilkkun
chmod +x ilkkun
sudo mv ilkkun /usr/local/bin/
```

## 사용법

### 기본 명령어

```bash
# Claude로 실행하고 Redis에 스트리밍
ilkkun -a claude -p "이 코드를 설명해줘"

# Redis 없이 실행 (stdout으로 출력)
ilkkun -a claude -p "안녕" --no-redis

# Gemini로 실행
ilkkun -a gemini -p "유닛 테스트 작성해줘" -s my-session-123

# Codex로 실행
ilkkun -a codex -p "버그 수정해줘" -c ./project

# 실행 없이 명령어 미리보기
ilkkun -a claude -p "안녕" --dry-run
```

### CLI 옵션

```
Options:
  -a, --agent <name>       에이전트 타입 (claude|gemini|codex) [필수]
  -p, --prompt <text>      프롬프트 텍스트 [필수, 또는 stdin 사용]
  -s, --session-id <id>    Redis 큐 키용 세션 ID [기본값: uuid]
  -c, --cwd <path>         작업 디렉토리 [기본값: 현재 디렉토리]
  -t, --timeout <ms>       타임아웃 (밀리초) [기본값: 300000]
  --extra-args <args>      에이전트에 전달할 추가 인자
  --dry-run                실행 없이 명령어 미리보기
  --no-redis               Redis 대신 stdout으로 출력
  --no-yolo                자동 승인 모드 비활성화
  -v, --version            버전 출력
  -h, --help               도움말 출력
```

### 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `REDIS_URL` | `redis://localhost:6379` | Redis 연결 URL |
| `REDIS_QUEUE_PREFIX` | `ilkkun:stream` | 큐 키 접두사 |
| `REDIS_QUEUE_TTL` | `3600` | 큐 TTL (초, 0 = 무제한) |
| `ILKKUN_CLAUDE_BIN` | `claude` | Claude CLI 바이너리 경로 |
| `ILKKUN_GEMINI_BIN` | `gemini` | Gemini CLI 바이너리 경로 |
| `ILKKUN_CODEX_BIN` | `codex` | Codex CLI 바이너리 경로 |
| `ILKKUN_DEFAULT_AGENT` | `claude` | 기본 에이전트 타입 |
| `ILKKUN_LOG_LEVEL` | `info` | 로그 레벨 (debug\|info\|warn\|error) |

### 종료 코드

| 코드 | 설명 |
|------|------|
| 0 | 성공 |
| 1 | 일반 에러 |
| 2 | CLI 인자 에러 |
| 3 | 에이전트 실행 실패 |
| 4 | Redis 연결 실패 |
| 5 | 타임아웃 |

## 이벤트 스키마

모든 에이전트 출력은 통합된 이벤트 스키마로 정규화됩니다:

```typescript
interface NormalizedEvent {
  id: string;                              // UUID v4
  source: 'claude' | 'gemini' | 'codex';
  sessionId: string;
  timestamp: number;                       // Unix 밀리초
  sequence: number;                        // 순서 보장
  type: EventType;
  payload: EventPayload;
  raw?: unknown;                           // 원본 데이터 (선택)
}

type EventType =
  | 'session.start' | 'session.end'
  | 'message.start' | 'message.delta' | 'message.end'
  | 'tool.start' | 'tool.delta' | 'tool.end'
  | 'thinking.start' | 'thinking.delta' | 'thinking.end'
  | 'error' | 'system';
```

## 개발

### 사전 요구사항

- [Bun](https://bun.sh/) 1.1+
- Redis 6.0+ (Redis 모드 사용 시)

### 설정

```bash
git clone https://github.com/turbokang/ilkkun.git
cd ilkkun
bun install
```

### 명령어

```bash
# 개발 모드로 실행
bun run src/index.ts -a claude -p "안녕" --no-redis

# 테스트 실행
bun test

# 바이너리 빌드
bun run build

# 타입 체크
bun run typecheck
```

### 프로젝트 구조

```
ilkkun/
├── src/
│   ├── index.ts              # 진입점
│   ├── cli.ts                # CLI 파싱
│   ├── config.ts             # 설정
│   ├── types.ts              # 타입 정의
│   ├── adapters/             # 에이전트 어댑터
│   ├── stream/               # 스트림 처리
│   ├── redis/                # Redis 퍼블리싱
│   └── process/              # 프로세스 관리
├── tests/
│   └── unit/                 # 유닛 테스트
└── .github/workflows/        # CI/CD
```

## 라이선스

MIT License - 자세한 내용은 [LICENSE](./LICENSE)를 참조하세요.

## 기여

기여를 환영합니다. 이슈를 열거나 풀 리퀘스트를 제출해 주세요.

---

## 기술 명세

상세한 기술 명세, 아키텍처 다이어그램, 구현 세부사항은 [기술 명세서](./docs/SPECIFICATION.ko.md)를 참조하세요.
